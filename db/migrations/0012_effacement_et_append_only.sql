-- =============================================================================
-- 0012 — Concilier l'immuabilité des traces et le droit à l'effacement
--
-- Problème résolu.
--
-- Les tables à valeur probante sont en append-only : ni UPDATE ni DELETE. Or la
-- suppression d'un compte déclenche, en cascade, des écritures sur ces tables :
--   · un ON DELETE SET NULL produit un UPDATE, pour dissocier la trace de la
--     personne sans la détruire ;
--   · un ON DELETE CASCADE produit un DELETE, quand l'atelier lui-même disparaît.
-- Le déclencheur refusait les deux, et la suppression d'un compte échouait.
--
-- Deux exigences légitimes s'opposent :
--   · la trace doit être immuable, c'est sa raison d'être ;
--   · la personne doit pouvoir obtenir l'effacement de ses données.
--
-- Solution en deux temps.
--
-- 1. Dissociation. Le déclencheur autorise l'UPDATE dont le SEUL effet est de
--    mettre à NULL une colonne de rattachement déclarée — l'acteur, l'atelier.
--    Le contenu de la trace reste rigoureusement immuable, et toute autre
--    modification est refusée.
--
-- 2. Effacement. Une opération d'effacement explicite pose le paramètre de
--    session app.erasure_mode, et peut alors supprimer. Ce paramètre n'est posé
--    que par le code d'effacement, dans sa propre transaction, après avoir
--    journalisé l'opération. L'immuabilité protège contre la réécriture
--    ordinaire ; elle n'a pas vocation à faire obstacle à l'exercice d'un droit.
-- =============================================================================

/**
 * Mode effacement. Actif uniquement pendant la transaction qui l'a posé.
 */
CREATE OR REPLACE FUNCTION app.erasure_mode() RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN coalesce(current_setting('app.erasure_mode', true), '') = 'on';
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;

COMMENT ON FUNCTION app.erasure_mode() IS
  'Vrai pendant une opération d''effacement explicite. Seule situation où une ligne append-only peut être supprimée.';

CREATE OR REPLACE FUNCTION app.forbid_update_delete_except_erasure() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  colonne text;
  ancienne_ligne jsonb;
  nouvelle_ligne jsonb;
  reste_ancien jsonb;
  reste_nouveau jsonb;
  dissociation_detectee boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF app.erasure_mode() THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION
      'La table % est en append-only : la suppression n''est autorisée que pendant un effacement explicite.',
      TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  ancienne_ligne := to_jsonb(OLD);
  nouvelle_ligne := to_jsonb(NEW);
  reste_ancien := ancienne_ligne;
  reste_nouveau := nouvelle_ligne;

  -- Les colonnes de rattachement déclarées peuvent passer à NULL, jamais
  -- prendre une nouvelle valeur.
  FOREACH colonne IN ARRAY TG_ARGV LOOP
    IF (ancienne_ligne ->> colonne) IS DISTINCT FROM (nouvelle_ligne ->> colonne) THEN
      IF (nouvelle_ligne ->> colonne) IS NOT NULL THEN
        RAISE EXCEPTION
          'La table % est en append-only : la colonne % ne peut être que dissociée, pas réaffectée.',
          TG_TABLE_NAME, colonne
          USING ERRCODE = 'restrict_violation';
      END IF;
      dissociation_detectee := true;
    END IF;
    reste_ancien := reste_ancien - colonne;
    reste_nouveau := reste_nouveau - colonne;
  END LOOP;

  IF NOT dissociation_detectee THEN
    RAISE EXCEPTION
      'La table % est en append-only : aucune modification n''est autorisée.', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- Tout le reste doit être rigoureusement identique.
  IF reste_ancien <> reste_nouveau THEN
    RAISE EXCEPTION
      'La table % est en append-only : le contenu de la trace ne peut pas être modifié.',
      TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

/**
 * Applique la garde append-only à une table, en déclarant les colonnes de
 * rattachement qui pourront être dissociées lors d'un effacement.
 */
CREATE OR REPLACE FUNCTION app.make_append_only_with_erasure(
  table_name text,
  VARIADIC detachable_columns text[]
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  arguments text;
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_append_only', table_name);

  SELECT string_agg(quote_literal(colonne), ', ')
    INTO arguments
    FROM unnest(detachable_columns) AS colonne;

  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION app.forbid_update_delete_except_erasure(%s)',
    table_name || '_append_only', table_name, arguments
  );
END;
$$;

SELECT app.make_append_only_with_erasure('audit_logs', 'actor_user_id', 'organization_id');
SELECT app.make_append_only_with_erasure('regulatory_calculations', 'requested_by');
SELECT app.make_append_only_with_erasure('generated_documents', 'generated_by');
SELECT app.make_append_only_with_erasure('regulatory_results', 'id');
SELECT app.make_append_only_with_erasure('validation_attestations', 'engine_version_code');
