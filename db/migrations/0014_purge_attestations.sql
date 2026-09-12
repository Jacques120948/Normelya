-- =============================================================================
-- 0014 — Pseudonymisation et purge automatique des attestations
--
-- Deux opérations, toutes deux exécutées par le rôle de service.
--
--   app.pseudonymize_attestations()   à la suppression d'un compte
--   app.purge_expired_attestations()  quotidiennement
--
-- Chacune pose elle-même le mode effacement, par la clause SET de sa
-- définition : le mode ne vaut que pendant l'exécution de la fonction et est
-- restauré à sa sortie. La transaction appelante ne se retrouve donc jamais
-- avec un mode effacement actif par inadvertance.
-- =============================================================================

/**
 * Durée de conservation d'une attestation après la suppression du compte.
 * Décision du 12 septembre 2026, à relire par un juriste en phase 9.
 */
CREATE OR REPLACE FUNCTION app.attestation_retention_years() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;

COMMENT ON FUNCTION app.attestation_retention_years() IS
  'Dix ans après la suppression du compte. Voir docs/18-conservation-des-attestations.md';

/**
 * Pseudonymise les attestations d'un compte supprimé.
 *
 * Efface le nom et l'adresse ; conserve l'horodatage, l'empreinte des données
 * validées, la version du moteur et l'identifiant technique du compte. Pose la
 * date de purge.
 *
 * Renvoie le nombre d'attestations traitées.
 */
CREATE OR REPLACE FUNCTION app.pseudonymize_attestations(target_user_id uuid, at timestamptz)
RETURNS integer
LANGUAGE plpgsql
SET app.erasure_mode = 'on'
AS $$
DECLARE
  traitees integer;
BEGIN
  UPDATE validation_attestations
  SET attested_by_name = NULL,
      attested_by_email = NULL,
      pseudonymized_at = at,
      purge_due_on = (at + make_interval(years => app.attestation_retention_years()))::date
  WHERE user_id = target_user_id
    AND pseudonymized_at IS NULL;

  GET DIAGNOSTICS traitees = ROW_COUNT;
  RETURN traitees;
END;
$$;

/**
 * Purge les attestations dont la durée de conservation est écoulée.
 *
 * La date d'évaluation est un paramètre : la fonction reste testable sans
 * dépendre de l'horloge du serveur.
 *
 * Renvoie le nombre d'attestations supprimées.
 */
CREATE OR REPLACE FUNCTION app.purge_expired_attestations(evaluated_on date)
RETURNS integer
LANGUAGE plpgsql
SET app.erasure_mode = 'on'
AS $$
DECLARE
  supprimees integer;
BEGIN
  DELETE FROM validation_attestations
  WHERE purge_due_on IS NOT NULL
    AND purge_due_on <= evaluated_on;

  GET DIAGNOSTICS supprimees = ROW_COUNT;
  RETURN supprimees;
END;
$$;

COMMENT ON FUNCTION app.purge_expired_attestations(date) IS
  'Purge automatique, exécutée quotidiennement. Ne touche jamais une attestation dont le compte existe encore : purge_due_on n''est posée qu''à la pseudonymisation.';

-- Seul le rôle de service exécute ces opérations.
REVOKE ALL ON FUNCTION app.pseudonymize_attestations(uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.purge_expired_attestations(date) FROM PUBLIC;
