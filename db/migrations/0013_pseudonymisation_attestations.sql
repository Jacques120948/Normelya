-- =============================================================================
-- 0013 — Attestations : pseudonymisation à la suppression du compte, puis purge
--
-- DÉCISION consignée le 12 septembre 2026, à faire relire par un juriste en
-- phase 9 (voir docs/18-conservation-des-attestations.md).
--
-- Une attestation de validation est la pièce qui établit qu'une personne a
-- confirmé avoir vérifié des informations, à une date donnée, sur des données
-- dont l'empreinte est conservée. C'est la principale défense en cas de litige.
--
-- Deux exigences se rencontrent :
--   · la personne peut demander l'effacement de ses données ;
--   · la pièce doit rester exploitable pour la constatation, l'exercice ou la
--     défense de droits en justice.
--
-- Choix retenu : PSEUDONYMISATION, pas suppression.
--   À la suppression du compte, le nom et l'adresse électronique sont effacés.
--   Sont conservés : l'horodatage, l'empreinte des données validées, la version
--   du moteur, et l'identifiant technique du compte.
--   Dix ans après la suppression du compte, l'attestation est purgée
--   automatiquement.
--
-- Base légale invoquée : règlement (UE) 2016/679, article 17, paragraphe 3,
-- point e). Durée de conservation encadrée par l'article 5, paragraphe 1,
-- point e).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Identité au moment de l'attestation
--
-- Elle est copiée dans la ligne plutôt que lue par jointure : une pièce
-- probante doit porter ce qui était vrai au moment où elle a été établie, et
-- rester lisible après la disparition du compte.
-- -----------------------------------------------------------------------------
ALTER TABLE validation_attestations
  ADD COLUMN attested_by_name text,
  ADD COLUMN attested_by_email citext,
  ADD COLUMN pseudonymized_at timestamptz,
  ADD COLUMN purge_due_on date;

COMMENT ON COLUMN validation_attestations.attested_by_name IS
  'Nom de la personne au moment de l''attestation. Effacé lors de la pseudonymisation.';
COMMENT ON COLUMN validation_attestations.attested_by_email IS
  'Adresse de la personne au moment de l''attestation. Effacée lors de la pseudonymisation.';
COMMENT ON COLUMN validation_attestations.pseudonymized_at IS
  'Date à laquelle le nom et l''adresse ont été effacés, à la suppression du compte.';
COMMENT ON COLUMN validation_attestations.purge_due_on IS
  'Date de purge automatique : dix ans après la suppression du compte.';

-- L'identifiant technique du compte survit à la suppression : la contrainte de
-- clé étrangère est donc retirée, la colonne devenant un identifiant conservé.
ALTER TABLE validation_attestations
  DROP CONSTRAINT validation_attestations_user_id_fkey;

COMMENT ON COLUMN validation_attestations.user_id IS
  'Identifiant technique du compte ayant attesté. Conservé après la suppression du compte, sans lien vers la table des utilisateurs.';

-- Une attestation pseudonymisée ne porte plus aucune identité et connaît sa
-- date de purge.
ALTER TABLE validation_attestations
  ADD CONSTRAINT validation_attestations_pseudonymisation_coherente CHECK (
    pseudonymized_at IS NULL
    OR (attested_by_name IS NULL AND attested_by_email IS NULL AND purge_due_on IS NOT NULL)
  );

CREATE INDEX validation_attestations_purge_idx
  ON validation_attestations (purge_due_on)
  WHERE purge_due_on IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Garde append-only étendue
--
-- Hors mode effacement, l'immuabilité reste stricte. En mode effacement, seules
-- les colonnes explicitement déclarées peuvent changer : c'est ce qui rend la
-- pseudonymisation possible sans ouvrir la porte à une réécriture.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.forbid_update_delete_except_erasure() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  colonne text;
  ancienne_ligne jsonb;
  nouvelle_ligne jsonb;
  reste_ancien jsonb;
  reste_nouveau jsonb;
  changement_detecte boolean := false;
  en_effacement boolean;
BEGIN
  en_effacement := app.erasure_mode();

  IF TG_OP = 'DELETE' THEN
    IF en_effacement THEN
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

  FOREACH colonne IN ARRAY TG_ARGV LOOP
    IF (ancienne_ligne ->> colonne) IS DISTINCT FROM (nouvelle_ligne ->> colonne) THEN
      -- Hors effacement, une colonne déclarée ne peut être que dissociée,
      -- c'est-à-dire mise à NULL. Pendant un effacement, elle peut aussi
      -- recevoir la valeur qui trace l'opération.
      IF NOT en_effacement AND (nouvelle_ligne ->> colonne) IS NOT NULL THEN
        RAISE EXCEPTION
          'La table % est en append-only : la colonne % ne peut être que dissociée, pas réaffectée.',
          TG_TABLE_NAME, colonne
          USING ERRCODE = 'restrict_violation';
      END IF;
      changement_detecte := true;
    END IF;
    reste_ancien := reste_ancien - colonne;
    reste_nouveau := reste_nouveau - colonne;
  END LOOP;

  IF NOT changement_detecte THEN
    RAISE EXCEPTION
      'La table % est en append-only : aucune modification n''est autorisée.', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF reste_ancien <> reste_nouveau THEN
    RAISE EXCEPTION
      'La table % est en append-only : le contenu de la trace ne peut pas être modifié.',
      TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Colonnes modifiables lors d'un effacement, pour cette table uniquement.
SELECT app.make_append_only_with_erasure(
  'validation_attestations',
  'attested_by_name', 'attested_by_email', 'pseudonymized_at', 'purge_due_on'
);
