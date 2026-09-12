-- =============================================================================
-- 0011 — Tables de l'authentification locale
--
-- RÉSERVÉ AU DÉVELOPPEMENT ET AUX TESTS.
--
-- Elles permettent d'exécuter le parcours complet — inscription, connexion,
-- réinitialisation, suppression — sans dépendre d'un service externe, et de
-- vérifier que le port AuthProvider tient sa promesse.
--
-- En production, l'authentification est déléguée à un fournisseur dédié et ces
-- tables restent vides. L'adaptateur qui les exploite refuse d'ailleurs de
-- s'instancier lorsque NODE_ENV vaut production.
-- =============================================================================

CREATE TABLE local_auth_accounts (
  subject         uuid PRIMARY KEY,
  email           citext NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  password_salt   text NOT NULL,
  email_verified  boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE local_auth_accounts IS
  'Comptes du fournisseur d''authentification local. Développement et tests uniquement.';

CREATE TABLE local_auth_tokens (
  token       text PRIMARY KEY,
  subject     uuid NOT NULL REFERENCES local_auth_accounts(subject) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('access', 'refresh', 'recovery')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX local_auth_tokens_subject_idx ON local_auth_tokens (subject);
CREATE INDEX local_auth_tokens_expiry_idx ON local_auth_tokens (expires_at);

-- Ces tables ne portent aucune donnée client et ne relèvent d'aucune
-- organisation : la Row Level Security, qui s'appuie sur l'appartenance à une
-- organisation, n'a rien à y filtrer. Les activer sans politique bloquerait
-- toute écriture, y compris celle du rôle de service.
--
-- Leur protection vient donc des privilèges : seul le rôle de service y accède,
-- le rôle applicatif n'a aucun droit dessus. Voir db/roles.sql.
REVOKE ALL ON TABLE local_auth_accounts FROM PUBLIC;
REVOKE ALL ON TABLE local_auth_tokens FROM PUBLIC;
