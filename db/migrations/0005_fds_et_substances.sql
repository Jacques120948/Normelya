-- =============================================================================
-- 0005 — Fiches de données de sécurité, versions, substances
--
-- Structure de stockage uniquement. Aucune donnée réglementaire, aucune table de
-- référence de mentions H / EUH / P : les valeurs stockées ici proviennent
-- exclusivement des documents fournisseurs déposés par l'utilisateur, puis de sa
-- validation explicite.
--
-- Deux charges utiles distinctes sont conservées pour chaque version :
--   · extracted_payload : ce que la lecture automatique a produit ;
--   · validated_payload : ce que l'utilisateur a corrigé et validé.
-- Seule la seconde alimente le moteur réglementaire.
-- =============================================================================

CREATE TYPE sds_version_status AS ENUM (
  'imported',        -- PDF déposé, pas encore analysé
  'extracting',      -- lecture en cours
  'needs_review',    -- lecture terminée, vérification humaine attendue
  'validated',       -- vérifiée et validée par un utilisateur
  'archived'         -- remplacée par une version plus récente
);

CREATE TYPE extraction_method AS ENUM ('pdf_text', 'ocr', 'ai_assisted', 'manual');
CREATE TYPE substance_data_source AS ENUM ('extracted', 'manual', 'corrected');

-- -----------------------------------------------------------------------------
-- safety_data_sheets — « la FDS de cette matière », entité stable
-- -----------------------------------------------------------------------------
CREATE TABLE safety_data_sheets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  raw_material_id   uuid NOT NULL REFERENCES raw_materials(id) ON DELETE CASCADE,
  supplier_id       uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  commercial_name   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX safety_data_sheets_material_idx ON safety_data_sheets (raw_material_id);
CREATE UNIQUE INDEX safety_data_sheets_material_unique_idx
  ON safety_data_sheets (raw_material_id) WHERE deleted_at IS NULL;

CREATE TRIGGER safety_data_sheets_set_updated_at
  BEFORE UPDATE ON safety_data_sheets FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- sds_versions — une révision datée, jamais écrasée
-- -----------------------------------------------------------------------------
CREATE TABLE sds_versions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  safety_data_sheet_id      uuid NOT NULL REFERENCES safety_data_sheets(id) ON DELETE CASCADE,
  document_id               uuid NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  version_label             text NOT NULL,
  revision_date             date,
  language                  text,
  status                    sds_version_status NOT NULL DEFAULT 'imported',

  -- Lecture automatique : jamais considérée comme validée.
  extracted_payload         jsonb,
  extraction_method         extraction_method,
  extraction_confidence     numeric(4,3) CHECK (
                              extraction_confidence IS NULL
                              OR (extraction_confidence >= 0 AND extraction_confidence <= 1)
                            ),

  -- Données validées : seule source consommée par le moteur.
  validated_payload         jsonb,
  validated_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_at              timestamptz,

  -- Champs physiques utiles aux calculs, issus de la validation.
  flash_point_celsius       numeric(6,2),

  archived_at               timestamptz,
  is_demo                   boolean NOT NULL DEFAULT false,
  created_by                uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sds_versions_label_unique UNIQUE (safety_data_sheet_id, version_label),
  -- Une version validée porte obligatoirement son auteur, sa date et ses données.
  CONSTRAINT sds_versions_validation_complete CHECK (
    status <> 'validated'
    OR (validated_by IS NOT NULL AND validated_at IS NOT NULL AND validated_payload IS NOT NULL)
  )
);

COMMENT ON TABLE sds_versions IS
  'Révisions successives d''une FDS. Une version n''est jamais écrasée ni supprimée automatiquement.';
COMMENT ON COLUMN sds_versions.validated_payload IS
  'Données validées par un utilisateur. Seule charge utile que le moteur réglementaire accepte de consommer.';

CREATE INDEX sds_versions_sheet_idx ON sds_versions (safety_data_sheet_id, created_at DESC);
CREATE INDEX sds_versions_status_idx ON sds_versions (organization_id, status);

-- Au plus une version active (validée non archivée) par FDS.
CREATE UNIQUE INDEX sds_versions_active_idx
  ON sds_versions (safety_data_sheet_id)
  WHERE status = 'validated' AND archived_at IS NULL;

CREATE TRIGGER sds_versions_set_updated_at
  BEFORE UPDATE ON sds_versions FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- sds_extraction_runs — traçabilité et coût de chaque tentative de lecture
-- -----------------------------------------------------------------------------
CREATE TABLE sds_extraction_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sds_version_id    uuid NOT NULL REFERENCES sds_versions(id) ON DELETE CASCADE,
  method            extraction_method NOT NULL,
  model             text,
  prompt_hash       text,
  token_cost        integer,
  duration_ms       integer,
  succeeded         boolean NOT NULL,
  raw_output        jsonb,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sds_extraction_runs_version_idx ON sds_extraction_runs (sds_version_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- substances — référentiel d'identification, non nominatif
--
-- Cette table ne contient que des identifiants (CAS, CE) et des dénominations.
-- Elle ne porte AUCUNE classification réglementaire : celle-ci provient toujours
-- de la FDS validée par l'utilisateur.
-- -----------------------------------------------------------------------------
CREATE TABLE substances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cas_number    text,
  ec_number     text,
  name_en       text,
  name_fr       text,
  source_ref    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT substances_cas_format CHECK (cas_number IS NULL OR cas_number ~ '^[0-9]{2,7}-[0-9]{2}-[0-9]$'),
  CONSTRAINT substances_ec_format CHECK (ec_number IS NULL OR ec_number ~ '^[0-9]{3}-[0-9]{3}-[0-9]$'),
  CONSTRAINT substances_identified CHECK (cas_number IS NOT NULL OR ec_number IS NOT NULL)
);

COMMENT ON TABLE substances IS
  'Identification des substances uniquement (CAS, CE, dénominations). Aucune classification réglementaire n''est stockée ici.';

CREATE UNIQUE INDEX substances_cas_idx ON substances (cas_number) WHERE cas_number IS NOT NULL;
CREATE UNIQUE INDEX substances_ec_idx ON substances (ec_number) WHERE ec_number IS NOT NULL;

CREATE TRIGGER substances_set_updated_at
  BEFORE UPDATE ON substances FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- sds_substances — composition déclarée dans une version de FDS
--
-- Les concentrations sont conservées telles que déclarées : une plage reste une
-- plage. Aucune valeur médiane n'est calculée ni stockée.
-- -----------------------------------------------------------------------------
CREATE TABLE sds_substances (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sds_version_id                uuid NOT NULL REFERENCES sds_versions(id) ON DELETE CASCADE,
  substance_id                  uuid REFERENCES substances(id) ON DELETE SET NULL,
  declared_name                 text NOT NULL,
  cas_number                    text,
  ec_number                     text,
  concentration_min             numeric(9,6) CHECK (concentration_min IS NULL OR (concentration_min >= 0 AND concentration_min <= 100)),
  concentration_max             numeric(9,6) CHECK (concentration_max IS NULL OR (concentration_max >= 0 AND concentration_max <= 100)),
  concentration_exact           numeric(9,6) CHECK (concentration_exact IS NULL OR (concentration_exact >= 0 AND concentration_exact <= 100)),
  -- Classification telle que déclarée par le fournisseur, reprise sans interprétation.
  classification                jsonb NOT NULL DEFAULT '[]'::jsonb,
  specific_concentration_limits jsonb NOT NULL DEFAULT '[]'::jsonb,
  m_factor_acute                numeric(12,4),
  m_factor_chronic              numeric(12,4),
  source                        substance_data_source NOT NULL DEFAULT 'extracted',
  position                      integer NOT NULL DEFAULT 0,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sds_substances_range_coherent CHECK (
    concentration_min IS NULL OR concentration_max IS NULL OR concentration_min <= concentration_max
  ),
  CONSTRAINT sds_substances_concentration_declared CHECK (
    concentration_exact IS NOT NULL OR concentration_min IS NOT NULL OR concentration_max IS NOT NULL
  )
);

COMMENT ON COLUMN sds_substances.classification IS
  'Classification telle que déclarée dans la FDS fournisseur. Normelya ne la déduit jamais.';

CREATE INDEX sds_substances_version_idx ON sds_substances (sds_version_id, position);
CREATE INDEX sds_substances_cas_idx ON sds_substances (cas_number) WHERE cas_number IS NOT NULL;

CREATE TRIGGER sds_substances_set_updated_at
  BEFORE UPDATE ON sds_substances FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE safety_data_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_data_sheets FORCE ROW LEVEL SECURITY;
CREATE POLICY safety_data_sheets_select ON safety_data_sheets FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY safety_data_sheets_write ON safety_data_sheets FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE sds_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY sds_versions_select ON sds_versions FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY sds_versions_insert ON sds_versions FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY sds_versions_update ON sds_versions FOR UPDATE
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
-- Aucune politique DELETE : une version de FDS ne se supprime pas.

ALTER TABLE sds_extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds_extraction_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY sds_extraction_runs_select ON sds_extraction_runs FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY sds_extraction_runs_insert ON sds_extraction_runs FOR INSERT
  WITH CHECK (app.is_member_of(organization_id));

-- Le référentiel d'identification est lisible par tout utilisateur authentifié
-- et n'est écrit que par le rôle de service.
ALTER TABLE substances ENABLE ROW LEVEL SECURITY;
ALTER TABLE substances FORCE ROW LEVEL SECURITY;
CREATE POLICY substances_select ON substances FOR SELECT
  USING (app.current_user_id() IS NOT NULL);

ALTER TABLE sds_substances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds_substances FORCE ROW LEVEL SECURITY;
CREATE POLICY sds_substances_select ON sds_substances FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY sds_substances_write ON sds_substances FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
