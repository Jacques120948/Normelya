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
-- Les mots de passe sont fournis par l'environnement, jamais écrits ici :
-- scripts/preparer-roles.mjs les pose par ALTER ROLE après ce fichier.
--
-- Ce fichier est rejouable : il peut être appliqué à un environnement neuf
-- comme à un environnement déjà configuré, sans effet de bord.
-- =============================================================================

-- Le rôle applicatif subit toutes les politiques, sans exception possible.
-- Le rôle de service les contourne, et n'est employé que par du code de
-- confiance qui ne reçoit aucun paramètre du client.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'normelya_app') THEN
    CREATE ROLE normelya_app LOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'normelya_service') THEN
    CREATE ROLE normelya_service LOGIN BYPASSRLS;
  END IF;
END
$$;

-- Réaffirmé à chaque exécution : c'est la propriété dont dépend toute
-- l'isolation. Un rôle applicatif qui gagnerait BYPASSRLS rendrait muettes
-- toutes les politiques, sans qu'aucun test fonctionnel ne le signale.
ALTER ROLE normelya_app     NOBYPASSRLS;
ALTER ROLE normelya_service BYPASSRLS;

GRANT USAGE ON SCHEMA public, app TO normelya_app, normelya_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO normelya_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO normelya_app, normelya_service;

-- Le rôle applicatif n'approche ni le journal des paiements ni le journal d'audit.
REVOKE ALL ON TABLE payment_events FROM normelya_app;
REVOKE INSERT, UPDATE, DELETE ON TABLE audit_logs FROM normelya_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO normelya_service;

-- Opérations d'effacement : pseudonymisation à la suppression d'un compte, et
-- purge des attestations dont la durée de conservation est écoulée. Réservées
-- au rôle de service : elles posent le mode effacement.
GRANT EXECUTE ON FUNCTION app.pseudonymize_attestations(uuid, timestamptz) TO normelya_service;
GRANT EXECUTE ON FUNCTION app.purge_expired_attestations(date) TO normelya_service;

-- Tables du fournisseur d'authentification local (développement uniquement).
-- Le rôle applicatif ne doit jamais les approcher : elles portent des
-- empreintes de mots de passe et des jetons de session.
REVOKE ALL ON TABLE local_auth_accounts, local_auth_tokens FROM normelya_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO normelya_app, normelya_service;
