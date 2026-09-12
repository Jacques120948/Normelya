-- =============================================================================
-- 0001 — Socle : extensions, schéma applicatif, fonctions de sécurité
--
-- Ce fichier ne contient aucune donnée métier et aucune constante réglementaire.
-- Il installe les briques réutilisées par toutes les migrations suivantes :
--   · résolution de l'utilisateur courant (compatible Supabase ou PostgreSQL nu) ;
--   · appartenance à une organisation, socle de toutes les politiques RLS ;
--   · mise à jour automatique de updated_at ;
--   · garde « append-only » pour les tables à valeur probante.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- adresses e-mail insensibles à la casse

CREATE SCHEMA IF NOT EXISTS app;

-- -----------------------------------------------------------------------------
-- Utilisateur courant
--
-- Deux sources possibles, dans cet ordre :
--   1. le paramètre de session app.current_user_id, posé par la couche
--      applicative via SET LOCAL (PostgreSQL nu, tests d'intégration) ;
--   2. la revendication « sub » du jeton, posée par le connecteur (Supabase).
-- Aucune des deux n'est renseignée => NULL => aucune ligne visible.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw_setting text;
  raw_claims  text;
BEGIN
  raw_setting := current_setting('app.current_user_id', true);
  IF raw_setting IS NOT NULL AND raw_setting <> '' THEN
    RETURN raw_setting::uuid;
  END IF;

  raw_claims := current_setting('request.jwt.claims', true);
  IF raw_claims IS NOT NULL AND raw_claims <> '' THEN
    RETURN NULLIF(raw_claims::json ->> 'sub', '')::uuid;
  END IF;

  RETURN NULL;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION app.current_user_id() IS
  'Identifiant de l''utilisateur courant, lu depuis le paramètre de session ou la revendication sub du jeton.';

-- -----------------------------------------------------------------------------
-- Organisation courante (facultative)
--
-- Utilisée pour restreindre encore la visibilité quand un utilisateur appartient
-- à plusieurs organisations. Non renseignée, toutes ses organisations sont
-- visibles ; renseignée, seule celle-ci l'est.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.current_organization_id() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw_setting text;
BEGIN
  raw_setting := current_setting('app.current_organization_id', true);
  IF raw_setting IS NULL OR raw_setting = '' THEN
    RETURN NULL;
  END IF;
  RETURN raw_setting::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

-- -----------------------------------------------------------------------------
-- Appartenance — pivot de toutes les politiques RLS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.is_member_of(target_organization_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app AS $$
DECLARE
  scoped_organization_id uuid := app.current_organization_id();
BEGIN
  -- Un contexte d'organisation explicite restreint la visibilité à celle-ci.
  IF scoped_organization_id IS NOT NULL AND scoped_organization_id <> target_organization_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.organization_id = target_organization_id
      AND m.user_id = app.current_user_id()
      AND m.accepted_at IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION app.is_member_of(uuid) IS
  'Vrai si l''utilisateur courant est membre accepté de l''organisation visée.';

-- Rôle de l'utilisateur courant dans une organisation, ou NULL.
CREATE OR REPLACE FUNCTION app.role_in(target_organization_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app AS $$
DECLARE
  found_role text;
BEGIN
  IF NOT app.is_member_of(target_organization_id) THEN
    RETURN NULL;
  END IF;

  SELECT m.role::text INTO found_role
  FROM public.organization_members m
  WHERE m.organization_id = target_organization_id
    AND m.user_id = app.current_user_id()
    AND m.accepted_at IS NOT NULL
  LIMIT 1;

  RETURN found_role;
END;
$$;

-- Hiérarchie des rôles, identique à celle du code applicatif (packages/core).
CREATE OR REPLACE FUNCTION app.role_rank(role_name text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE role_name
    WHEN 'owner'  THEN 3
    WHEN 'admin'  THEN 2
    WHEN 'member' THEN 1
    WHEN 'viewer' THEN 0
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION app.has_role_at_least(target_organization_id uuid, required_role text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app.role_rank(app.role_in(target_organization_id)) >= app.role_rank(required_role);
$$;

-- -----------------------------------------------------------------------------
-- Mise à jour automatique de updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Garde « append-only »
--
-- Les tables à valeur probante (calculs et résultats réglementaires, documents
-- générés, journal d'audit) n'acceptent que des INSERT. Corriger une analyse
-- consiste à en produire une nouvelle, jamais à réécrire la précédente.
-- Voir docs/adr/0003-append-only-sur-les-donnees-reglementaires.md
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.forbid_update_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'La table % est en append-only : ni UPDATE ni DELETE ne sont autorisés.',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Applique la garde append-only à une table.
CREATE OR REPLACE FUNCTION app.make_append_only(table_name text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION app.forbid_update_delete()',
    table_name || '_append_only', table_name
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Journal des migrations appliquées
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  checksum    text NOT NULL
);
