-- =============================================================================
-- 0002 — Identité, organisations, membres, invitations, sessions
--
-- L'organisation est l'unité d'isolation et de facturation. Toute donnée client
-- porte organization_id et une politique RLS fondée sur app.is_member_of().
-- =============================================================================

CREATE TYPE organization_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE organization_country AS ENUM ('FR', 'CH');
CREATE TYPE organization_activity AS ENUM ('candles', 'wax_melts', 'both');
CREATE TYPE app_locale AS ENUM ('fr', 'de', 'it', 'en');

-- -----------------------------------------------------------------------------
-- users
--
-- Le mot de passe n'est PAS stocké ici : l'authentification est déléguée au
-- fournisseur (port AuthProvider). Cette table porte le profil applicatif et
-- l'identifiant partagé avec le fournisseur d'authentification.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider       text NOT NULL DEFAULT 'supabase',
  auth_subject        text NOT NULL,
  email               citext NOT NULL,
  email_verified_at   timestamptz,
  first_name          text,
  last_name           text,
  phone               text,
  locale              app_locale NOT NULL DEFAULT 'fr',
  is_platform_admin   boolean NOT NULL DEFAULT false,
  last_seen_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_auth_subject_unique UNIQUE (auth_provider, auth_subject),
  CONSTRAINT users_email_format CHECK (position('@' in email) > 1)
);

COMMENT ON COLUMN users.is_platform_admin IS
  'Accès au back-office Normelya. Jamais exposé dans un jeton client : lu en base à chaque requête.';

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- organizations — l'atelier
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  legal_name                text,
  country                   organization_country NOT NULL,
  address_line1             text,
  address_line2             text,
  postal_code               text,
  city                      text,
  vat_number                text,
  contact_email             citext,
  contact_phone             text,
  activity                  organization_activity NOT NULL DEFAULT 'candles',
  default_locale            app_locale NOT NULL DEFAULT 'fr',
  onboarding_completed_at   timestamptz,
  is_demo                   boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz,
  CONSTRAINT organizations_name_not_blank CHECK (length(btrim(name)) > 0)
);

COMMENT ON COLUMN organizations.is_demo IS
  'Organisation de démonstration. Ses données sont préfixées DEMO et n''alimentent jamais le moteur réglementaire.';

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- organization_members — pivot de toutes les politiques RLS
-- -----------------------------------------------------------------------------
CREATE TABLE organization_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role              organization_role NOT NULL DEFAULT 'member',
  invited_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  invited_at        timestamptz,
  accepted_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_unique UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_members_user_idx ON organization_members (user_id);
CREATE INDEX organization_members_org_idx ON organization_members (organization_id);

-- Une organisation conserve toujours au moins un propriétaire.
CREATE UNIQUE INDEX organization_members_single_owner_idx
  ON organization_members (organization_id)
  WHERE role = 'owner';

CREATE TRIGGER organization_members_set_updated_at
  BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- invitations
-- -----------------------------------------------------------------------------
CREATE TABLE invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email             citext NOT NULL,
  role              organization_role NOT NULL DEFAULT 'member',
  token_hash        text NOT NULL,
  invited_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at        timestamptz NOT NULL,
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_role_not_owner CHECK (role <> 'owner')
);

CREATE UNIQUE INDEX invitations_token_hash_idx ON invitations (token_hash);
CREATE UNIQUE INDEX invitations_pending_idx
  ON invitations (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMENT ON COLUMN invitations.token_hash IS
  'Empreinte du jeton d''invitation. Le jeton en clair n''est jamais stocké.';

-- -----------------------------------------------------------------------------
-- user_sessions — journal des sessions, pour révocation et audit
-- -----------------------------------------------------------------------------
CREATE TABLE user_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ip_hash           text,
  user_agent_hash   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at        timestamptz
);

CREATE INDEX user_sessions_user_idx ON user_sessions (user_id, created_at DESC);

COMMENT ON COLUMN user_sessions.ip_hash IS
  'Empreinte de l''adresse IP, jamais l''adresse en clair (minimisation RGPD).';

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Un utilisateur voit sa propre fiche, et celle des membres de ses organisations.
CREATE POLICY users_select ON users FOR SELECT USING (
  id = app.current_user_id()
  OR EXISTS (
    SELECT 1
    FROM organization_members mine
    JOIN organization_members theirs ON theirs.organization_id = mine.organization_id
    WHERE mine.user_id = app.current_user_id()
      AND theirs.user_id = users.id
  )
);

-- Un utilisateur ne modifie que sa propre fiche, et jamais son statut d'administrateur
-- de plateforme : cette colonne est réservée au rôle de service.
CREATE POLICY users_update ON users FOR UPDATE
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY organizations_select ON organizations FOR SELECT
  USING (app.is_member_of(id));

CREATE POLICY organizations_update ON organizations FOR UPDATE
  USING (app.has_role_at_least(id, 'admin'))
  WITH CHECK (app.has_role_at_least(id, 'admin'));

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;

CREATE POLICY organization_members_select ON organization_members FOR SELECT
  USING (user_id = app.current_user_id() OR app.is_member_of(organization_id));

CREATE POLICY organization_members_insert ON organization_members FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'admin'));

CREATE POLICY organization_members_update ON organization_members FOR UPDATE
  USING (app.has_role_at_least(organization_id, 'admin'))
  WITH CHECK (app.has_role_at_least(organization_id, 'admin'));

CREATE POLICY organization_members_delete ON organization_members FOR DELETE
  USING (app.has_role_at_least(organization_id, 'admin'));

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY invitations_select ON invitations FOR SELECT
  USING (app.has_role_at_least(organization_id, 'admin'));

CREATE POLICY invitations_write ON invitations FOR ALL
  USING (app.has_role_at_least(organization_id, 'admin'))
  WITH CHECK (app.has_role_at_least(organization_id, 'admin'));

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY user_sessions_select ON user_sessions FOR SELECT
  USING (user_id = app.current_user_id());

CREATE POLICY user_sessions_update ON user_sessions FOR UPDATE
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
