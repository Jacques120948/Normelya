-- =============================================================================
-- 0007 — Traçabilité des calculs réglementaires, UFI, étiquettes, documents générés
--
-- Objectif : un résultat doit être rejouable à l'identique des années plus tard.
-- Chaque calcul mémorise donc, de façon immuable :
--   · la version du moteur utilisée ;
--   · la date du calcul ;
--   · la recette figée (version de produit verrouillée) ;
--   · les versions exactes de FDS utilisées ;
--   · l'intégralité des données d'entrée, sérialisées ;
--   · le résultat produit.
--
-- Ces tables sont en append-only : on ne corrige pas une analyse, on en produit
-- une nouvelle. Voir docs/adr/0003-append-only-sur-les-donnees-reglementaires.md
--
-- AUCUNE constante réglementaire n'est définie ici. Les colonnes sont des
-- réceptacles ; leur contenu proviendra du moteur, en phase 5, après validation
-- humaine des sources (voir CLAUDE.md, points d'arrêt obligatoires).
-- =============================================================================

CREATE TYPE regulatory_scope AS ENUM ('EU', 'FR', 'CH');
CREATE TYPE regulatory_status AS ENUM (
  'completed', 'needs_verification', 'action_required', 'not_applicable'
);
CREATE TYPE ufi_requirement AS ENUM ('yes', 'no', 'verification_required');
CREATE TYPE generated_document_type AS ENUM (
  'label_pdf', 'label_png', 'analysis_report', 'product_dossier', 'data_export'
);

-- -----------------------------------------------------------------------------
-- regulatory_engine_versions
--
-- Une version de moteur est un jeu de règles figé. rules_digest permet de
-- détecter qu'une règle a été modifiée sans publication d'une nouvelle version.
-- Table volontairement vide à ce stade : aucune version n'est publiée tant que
-- les sources réglementaires ne sont pas validées.
-- -----------------------------------------------------------------------------
CREATE TABLE regulatory_engine_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  scope         regulatory_scope NOT NULL,
  released_at   timestamptz,
  notes         text,
  rules_digest  text NOT NULL,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_engine_versions_code_format CHECK (code ~ '^NORMELYA_[A-Z0-9_]+$')
);

COMMENT ON TABLE regulatory_engine_versions IS
  'Versions publiées du moteur. Vide tant qu''aucun jeu de règles n''a été validé humainement.';

-- -----------------------------------------------------------------------------
-- regulatory_calculations — la demande et son empreinte (APPEND-ONLY)
-- -----------------------------------------------------------------------------
CREATE TABLE regulatory_calculations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_version_id    uuid NOT NULL REFERENCES product_versions(id) ON DELETE RESTRICT,
  recipe_id             uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  market                market_code NOT NULL,
  engine_version_code   text NOT NULL REFERENCES regulatory_engine_versions(code),

  -- Données d'entrée complètes et figées, telles que transmises au moteur.
  input_payload         jsonb NOT NULL,
  -- Empreinte de l'entrée normalisée : preuve de déterminisme et clé de cache.
  input_digest          text NOT NULL,
  -- Versions de FDS effectivement utilisées, dénormalisées pour la relecture.
  sds_version_ids       uuid[] NOT NULL DEFAULT '{}',

  requested_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regulatory_calculations_digest_format CHECK (input_digest ~ '^[0-9a-f]{64}$')
);

COMMENT ON COLUMN regulatory_calculations.input_payload IS
  'Entrée intégrale du moteur, figée. Permet de rejouer le calcul à l''identique.';
COMMENT ON COLUMN regulatory_calculations.input_digest IS
  'Empreinte sha256 de l''entrée normalisée. Deux calculs de même empreinte et même version de moteur doivent produire le même résultat.';

CREATE INDEX regulatory_calculations_product_idx
  ON regulatory_calculations (product_version_id, market, created_at DESC);
CREATE INDEX regulatory_calculations_org_idx
  ON regulatory_calculations (organization_id, created_at DESC);
-- Un calcul identique (même entrée, même moteur, même marché) est réutilisable.
CREATE INDEX regulatory_calculations_replay_idx
  ON regulatory_calculations (input_digest, engine_version_code, market);

SELECT app.make_append_only('regulatory_calculations');

-- -----------------------------------------------------------------------------
-- regulatory_results — la réponse (APPEND-ONLY)
-- -----------------------------------------------------------------------------
CREATE TABLE regulatory_results (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  calculation_id              uuid NOT NULL UNIQUE REFERENCES regulatory_calculations(id) ON DELETE RESTRICT,
  overall_status              regulatory_status NOT NULL,

  -- Sorties d'étiquetage. Alimentées exclusivement par le moteur.
  signal_word                 text,
  pictograms                  text[] NOT NULL DEFAULT '{}',
  hazard_statements           jsonb NOT NULL DEFAULT '[]'::jsonb,
  euh_statements              jsonb NOT NULL DEFAULT '[]'::jsonb,
  precautionary_statements    jsonb NOT NULL DEFAULT '[]'::jsonb,
  classifications             jsonb NOT NULL DEFAULT '[]'::jsonb,

  ufi_required                ufi_requirement NOT NULL DEFAULT 'verification_required',

  -- Points nécessitant une vérification humaine (REGULATORY_REVIEW_REQUIRED).
  review_flags                jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Pour chaque sortie : la règle et la source qui l'ont produite.
  explanation_trace           jsonb NOT NULL DEFAULT '[]'::jsonb,

  computed_at                 timestamptz NOT NULL DEFAULT now(),
  duration_ms                 integer
);

COMMENT ON COLUMN regulatory_results.review_flags IS
  'Points non tranchés par le moteur. Un résultat sans règle applicable porte un drapeau, jamais une valeur estimée.';
COMMENT ON COLUMN regulatory_results.explanation_trace IS
  'Justification de chaque sortie : identifiant de règle et référence de source.';

CREATE INDEX regulatory_results_org_idx ON regulatory_results (organization_id, computed_at DESC);
CREATE INDEX regulatory_results_status_idx ON regulatory_results (organization_id, overall_status);

SELECT app.make_append_only('regulatory_results');

-- -----------------------------------------------------------------------------
-- ufi_records
--
-- Normelya enregistre un UFI et explique les démarches. Il ne les effectue pas.
-- -----------------------------------------------------------------------------
CREATE TABLE ufi_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id                uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ufi_code                  text NOT NULL,
  formulation_number        text,
  source                    text NOT NULL DEFAULT 'user_provided',
  declared_to_authority     boolean NOT NULL DEFAULT false,
  declaration_reference     text,
  declared_at               timestamptz,
  notes                     text,
  created_by                uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ufi_records_source_supported CHECK (source IN ('user_provided', 'generated')),
  CONSTRAINT ufi_records_product_unique UNIQUE (product_id, ufi_code)
);

COMMENT ON TABLE ufi_records IS
  'Enregistrement d''un UFI. Ne remplace jamais les notifications ou déclarations obligatoires auprès des autorités compétentes.';

CREATE TRIGGER ufi_records_set_updated_at
  BEFORE UPDATE ON ufi_records FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- labels
--
-- Une étiquette est un rendu d'un résultat de moteur : elle ne peut pas exister
-- sans lui, et son contenu réglementaire n'est pas modifiable à la main.
-- -----------------------------------------------------------------------------
CREATE TABLE labels (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_version_id      uuid NOT NULL REFERENCES product_versions(id) ON DELETE RESTRICT,
  regulatory_result_id    uuid NOT NULL REFERENCES regulatory_results(id) ON DELETE RESTRICT,
  format                  text NOT NULL,
  width_mm                numeric(6,2) NOT NULL CHECK (width_mm > 0),
  height_mm               numeric(6,2) NOT NULL CHECK (height_mm > 0),
  layout                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  supplier_block          jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra_text              text,
  -- Vrai si le contenu réglementaire obligatoire ne tient pas dans le format.
  -- Aucune mention n'est jamais tronquée : l'étiquette est signalée comme
  -- impossible à produire dans ce format.
  overflow                boolean NOT NULL DEFAULT false,
  created_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX labels_version_idx ON labels (product_version_id, created_at DESC);

CREATE TRIGGER labels_set_updated_at
  BEFORE UPDATE ON labels FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- generated_documents — chaque export est daté et rattaché à ses sources (APPEND-ONLY)
-- -----------------------------------------------------------------------------
CREATE TABLE generated_documents (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id             uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  type                    generated_document_type NOT NULL,
  product_version_id      uuid REFERENCES product_versions(id) ON DELETE SET NULL,
  regulatory_result_id    uuid REFERENCES regulatory_results(id) ON DELETE SET NULL,
  label_id                uuid REFERENCES labels(id) ON DELETE SET NULL,
  engine_version_code     text REFERENCES regulatory_engine_versions(code),
  source_document_ids     uuid[] NOT NULL DEFAULT '{}',
  generated_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generated_documents_org_idx ON generated_documents (organization_id, generated_at DESC);
CREATE INDEX generated_documents_version_idx ON generated_documents (product_version_id);

SELECT app.make_append_only('generated_documents');

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Les versions de moteur sont publiques en lecture : elles figurent sur les
-- documents générés et doivent pouvoir être vérifiées.
ALTER TABLE regulatory_engine_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_engine_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY regulatory_engine_versions_select ON regulatory_engine_versions FOR SELECT
  USING (true);

ALTER TABLE regulatory_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_calculations FORCE ROW LEVEL SECURITY;
CREATE POLICY regulatory_calculations_select ON regulatory_calculations FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY regulatory_calculations_insert ON regulatory_calculations FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
-- Aucune politique UPDATE/DELETE : append-only, doublé du déclencheur.

ALTER TABLE regulatory_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_results FORCE ROW LEVEL SECURITY;
CREATE POLICY regulatory_results_select ON regulatory_results FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY regulatory_results_insert ON regulatory_results FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE ufi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ufi_records FORCE ROW LEVEL SECURITY;
CREATE POLICY ufi_records_select ON ufi_records FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY ufi_records_write ON ufi_records FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels FORCE ROW LEVEL SECURITY;
CREATE POLICY labels_select ON labels FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY labels_write ON labels FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY generated_documents_select ON generated_documents FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY generated_documents_insert ON generated_documents FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
