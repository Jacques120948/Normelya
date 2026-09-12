-- =============================================================================
-- Rôles PostgreSQL — à appliquer une fois par environnement
--
-- Trois rôles distincts, jamais confondus :
--
--   normelya_app       rôle de l'application. Non propriétaire des tables,
--                      SANS BYPASSRLS : toutes les politiques s'appliquent.
--                      Ne peut pas écrire dans payment_events ni audit_logs.
--
--   normelya_service   rôle des traitements de confiance : création de compte,
--                      journal d'audit, webhooks de paiement, tâches planifiées.
--                      Il possède BYPASSRLS, car il écrit dans des tables qui
--                      n'appartiennent à aucune organisation et pour lesquelles
--                      les politiques n'ont donc rien à filtrer — créer un
--                      utilisateur avant qu'il ait une organisation en est
--                      l'exemple type.
--
--                      C'est la raison d'être de la séparation : le rôle qui
--                      sert les requêtes des utilisateurs, lui, n'a jamais ce
--                      privilège. Le code qui emploie normelya_service est
--                      limité aux cas d'usage listés ci-dessus et n'accepte
--                      jamais d'identifiant d'organisation venu du client.
--
--   normelya_migrator  propriétaire du schéma, utilisé uniquement par les
--                      migrations. Jamais employé au service d'une requête.
--
-- Les mots de passe sont fournis par l'environnement, jamais écrits ici.
-- =============================================================================

-- \set app_password    '...'
-- \set service_password '...'

-- Le rôle applicatif subit toutes les politiques, sans exception possible.
CREATE ROLE normelya_app      LOGIN NOBYPASSRLS;

-- Le rôle de service les contourne, et n'est employé que par du code de
-- confiance qui ne reçoit aucun paramètre du client.
CREATE ROLE normelya_service  LOGIN BYPASSRLS;

GRANT USAGE ON SCHEMA public, app TO normelya_app, normelya_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO normelya_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO normelya_app, normelya_service;

-- Le rôle applicatif n'approche ni le journal des paiements ni le journal d'audit.
REVOKE ALL ON TABLE payment_events FROM normelya_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE audit_logs FROM normelya_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO normelya_service;

-- Tables du fournisseur d'authentification local (développement uniquement).
-- Le rôle applicatif ne doit jamais les approcher : elles portent des
-- empreintes de mots de passe et des jetons de session.
REVOKE ALL ON TABLE local_auth_accounts, local_auth_tokens FROM normelya_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO normelya_app, normelya_service;
