-- =============================================================================
-- Rôles PostgreSQL — à appliquer une fois par environnement
--
-- Trois rôles distincts, jamais confondus :
--
--   normelya_app       rôle de l'application. Non propriétaire des tables,
--                      SANS BYPASSRLS : toutes les politiques s'appliquent.
--                      Ne peut pas écrire dans payment_events ni audit_logs.
--
--   normelya_service   rôle des traitements de confiance (webhooks de paiement,
--                      écriture du journal d'audit, tâches planifiées).
--                      Contourne les politiques sur ces seules tables.
--
--   normelya_migrator  propriétaire du schéma, utilisé uniquement par les
--                      migrations. Jamais employé au service d'une requête.
--
-- Les mots de passe sont fournis par l'environnement, jamais écrits ici.
-- =============================================================================

-- \set app_password    '...'
-- \set service_password '...'

CREATE ROLE normelya_app      LOGIN NOBYPASSRLS;
CREATE ROLE normelya_service  LOGIN NOBYPASSRLS;

GRANT USAGE ON SCHEMA public, app TO normelya_app, normelya_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO normelya_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO normelya_app, normelya_service;

-- Le rôle applicatif n'approche ni le journal des paiements ni le journal d'audit.
REVOKE ALL ON TABLE payment_events FROM normelya_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE audit_logs FROM normelya_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO normelya_service;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO normelya_app, normelya_service;
