-- =============================================================================
-- 0010 — Grille tarifaire révisée, états de calcul, attestations de validation
--
-- Trois évolutions structurantes :
--
--  1. Les offres passent à 0 / 9 / 15 / 25 €. L'offre gratuite reçoit un
--     plafond CUMULATIF de produits : archiver un produit ne libère pas de
--     place, le quota n'est pas renouvelable.
--
--  2. Le moteur réglementaire distingue trois états de calcul, enregistrés
--     séparément du statut d'affichage : calcul complet, calcul avec hypothèse
--     explicite, vérification complémentaire nécessaire.
--
--  3. La validation humaine devient une brique juridique : une attestation
--     append-only, horodatée et scellée par une empreinte, conditionne toute
--     génération de document.
--
-- Aucune constante réglementaire n'est introduite ici.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Offres
-- -----------------------------------------------------------------------------
ALTER TABLE plans
  ADD COLUMN max_lifetime_products integer
    CHECK (max_lifetime_products IS NULL OR max_lifetime_products > 0);

COMMENT ON COLUMN plans.max_lifetime_products IS
  'Plafond cumulatif de produits créés depuis l''ouverture du compte. NULL = aucun plafond cumulatif. Utilisé par l''offre gratuite, dont le quota n''est pas renouvelable.';

UPDATE plans SET
  price_monthly_cents = 0,
  price_yearly_cents = 0,
  max_active_products = 3,
  max_lifetime_products = 3,
  tagline = 'Trois produits documentés, pour évaluer réellement Normelya.'
WHERE code = 'free';

UPDATE plans SET
  price_monthly_cents = 900,
  price_yearly_cents = 9000,
  max_active_products = 15,
  max_lifetime_products = NULL
WHERE code = 'essential';

UPDATE plans SET
  price_monthly_cents = 1500,
  price_yearly_cents = 15000,
  max_active_products = NULL,
  max_lifetime_products = NULL,
  tagline = 'Produits illimités, avec la FDS du produit dilué et l''UFI.',
  features = '["sds_import","regulatory_analysis","labels","product_sds","history","ufi","document_archive","exports","assistant"]'::jsonb
WHERE code = 'pro';

UPDATE plans SET
  price_monthly_cents = 2500,
  price_yearly_cents = 25000,
  max_active_products = NULL,
  max_lifetime_products = NULL,
  tagline = 'Tout Pro, plus les lots, la traçabilité et les coûts.',
  features = '["sds_import","regulatory_analysis","labels","product_sds","history","ufi","document_archive","exports","assistant","lots","costing","multi_user"]'::jsonb
WHERE code = 'atelier';

-- -----------------------------------------------------------------------------
-- 2. États de calcul du moteur
-- -----------------------------------------------------------------------------
CREATE TYPE computation_state AS ENUM (
  'complete',          -- toutes les données nécessaires étaient présentes
  'with_assumption',   -- une hypothèse explicite a été appliquée
  'review_required'    -- donnée bloquante manquante, aucun résultat produit
);

ALTER TABLE regulatory_results
  ADD COLUMN computation_state computation_state NOT NULL DEFAULT 'review_required',
  ADD COLUMN assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN threshold_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN regulatory_results.computation_state IS
  'Ce que le moteur a pu faire. Distinct de overall_status, qui dit ce que l''utilisateur doit faire.';
COMMENT ON COLUMN regulatory_results.assumptions IS
  'Hypothèses explicites appliquées, par exemple une plage de concentration ramenée à sa borne haute. Une hypothèse est toujours affichée et journalisée.';
COMMENT ON COLUMN regulatory_results.threshold_warnings IS
  'Valeurs calculées situées à moins de 10 % sous un seuil de bascule. Une petite variation de recette changerait le résultat.';

-- Un calcul avec hypothèse porte obligatoirement le détail de ses hypothèses,
-- et un calcul complet n'en porte aucune.
ALTER TABLE regulatory_results
  ADD CONSTRAINT regulatory_results_assumptions_coherent CHECK (
    (computation_state = 'with_assumption' AND jsonb_array_length(assumptions) > 0)
    OR (computation_state = 'complete' AND jsonb_array_length(assumptions) = 0)
    OR computation_state = 'review_required'
  );

-- Une vérification complémentaire est toujours motivée.
ALTER TABLE regulatory_results
  ADD CONSTRAINT regulatory_results_review_motivated CHECK (
    computation_state <> 'review_required' OR jsonb_array_length(review_flags) > 0
  );

-- -----------------------------------------------------------------------------
-- 3. Attestations de validation humaine
--
-- Table append-only. Elle enregistre ce que l'utilisateur a confirmé avoir
-- vérifié, quand, et sur quelles données exactement — l'empreinte scelle le
-- contenu validé, de sorte qu'une modification ultérieure soit détectable.
-- C'est la principale pièce de défense en cas de litige.
-- -----------------------------------------------------------------------------
CREATE TYPE attestation_scope AS ENUM (
  'sds_version',          -- vérification des données lues dans une FDS fournisseur
  'recipe',               -- vérification d'une recette avant analyse
  'document_generation'   -- confirmation avant génération d'un document
);

CREATE TABLE validation_attestations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scope                 attestation_scope NOT NULL,
  entity_type           text NOT NULL,
  entity_id             uuid NOT NULL,

  -- Empreinte des données telles que présentées à l'utilisateur au moment où il
  -- a coché la case. Permet de prouver ce qui a été validé.
  data_hash             text NOT NULL,
  -- Texte exact de la déclaration acceptée, conservé mot pour mot.
  statement_text        text NOT NULL,
  engine_version_code   text REFERENCES regulatory_engine_versions(code),

  accepted_at           timestamptz NOT NULL DEFAULT now(),
  ip_hash               text,
  user_agent_hash       text,

  CONSTRAINT validation_attestations_hash_format CHECK (data_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT validation_attestations_statement_not_blank
    CHECK (length(btrim(statement_text)) > 0)
);

COMMENT ON TABLE validation_attestations IS
  'Trace non modifiable de la validation humaine. Conditionne toute génération de document.';

CREATE INDEX validation_attestations_entity_idx
  ON validation_attestations (entity_type, entity_id, accepted_at DESC);
CREATE INDEX validation_attestations_org_idx
  ON validation_attestations (organization_id, accepted_at DESC);

SELECT app.make_append_only('validation_attestations');

ALTER TABLE validation_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_attestations FORCE ROW LEVEL SECURITY;

CREATE POLICY validation_attestations_select ON validation_attestations FOR SELECT
  USING (app.is_member_of(organization_id));

-- Un utilisateur ne peut attester qu'en son propre nom.
CREATE POLICY validation_attestations_insert ON validation_attestations FOR INSERT
  WITH CHECK (
    app.has_role_at_least(organization_id, 'member')
    AND user_id = app.current_user_id()
  );

-- -----------------------------------------------------------------------------
-- 4. Documents générés : deux documents par produit
--
-- L'étiquette CLP et la FDS du produit dilué. Chacun horodaté, versionné, et
-- rattaché à l'attestation de validation qui l'a autorisé.
-- -----------------------------------------------------------------------------
ALTER TABLE generated_documents
  ADD COLUMN validation_attestation_id uuid
    REFERENCES validation_attestations(id) ON DELETE RESTRICT,
  ADD COLUMN format_reference text;

COMMENT ON COLUMN generated_documents.validation_attestation_id IS
  'Attestation de validation ayant autorisé cette génération. Obligatoire pour une étiquette ou une FDS de produit.';
COMMENT ON COLUMN generated_documents.format_reference IS
  'Référence du format appliqué, par exemple le règlement définissant la structure d''une fiche de données de sécurité.';

-- Les documents réglementaires exigent une attestation ; un export de données
-- personnelles n'en exige pas.
ALTER TABLE generated_documents
  ADD CONSTRAINT generated_documents_attestation_required CHECK (
    type NOT IN ('label_pdf', 'label_png', 'product_sds_pdf', 'analysis_report')
    OR validation_attestation_id IS NOT NULL
  );
