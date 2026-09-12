-- =============================================================================
-- 0004 — Fournisseurs, matières premières, documents
--
-- documents est la table unique de tous les fichiers, déposés ou générés.
-- L'empreinte sha256 sert à la déduplication et à la traçabilité : un PDF
-- déposé deux fois n'est stocké et analysé qu'une seule fois.
-- =============================================================================

CREATE TYPE raw_material_category AS ENUM (
  'fragrance', 'wax', 'dye', 'additive', 'wick', 'other'
);
CREATE TYPE raw_material_form AS ENUM ('liquid', 'solid', 'powder', 'other');
CREATE TYPE purchase_unit AS ENUM ('g', 'kg', 'ml', 'l', 'unit');
CREATE TYPE document_kind AS ENUM (
  'sds',                    -- fiche de données de sécurité fournisseur
  'ifra',                   -- certificat IFRA
  'allergen_declaration',   -- déclaration d'allergènes
  'technical_sheet',
  'label',
  'analysis_report',
  'other'
);

CREATE TABLE suppliers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  website           text,
  contact_email     citext,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT suppliers_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX suppliers_org_idx ON suppliers (organization_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX suppliers_org_name_idx
  ON suppliers (organization_id, lower(name)) WHERE deleted_at IS NULL;

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE raw_materials (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  internal_reference    text,
  category              raw_material_category NOT NULL,
  form                  raw_material_form,
  density_g_per_ml      numeric(8,4) CHECK (density_g_per_ml IS NULL OR density_g_per_ml > 0),
  purchase_price_cents  integer CHECK (purchase_price_cents IS NULL OR purchase_price_cents >= 0),
  purchase_quantity     numeric(12,4) CHECK (purchase_quantity IS NULL OR purchase_quantity > 0),
  purchase_unit         purchase_unit,
  is_archived           boolean NOT NULL DEFAULT false,
  is_demo               boolean NOT NULL DEFAULT false,
  notes                 text,
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  CONSTRAINT raw_materials_name_not_blank CHECK (length(btrim(name)) > 0),
  -- Un prix d'achat n'a de sens qu'accompagné d'une quantité et d'une unité.
  CONSTRAINT raw_materials_purchase_coherent CHECK (
    purchase_price_cents IS NULL
    OR (purchase_quantity IS NOT NULL AND purchase_unit IS NOT NULL)
  )
);

COMMENT ON COLUMN raw_materials.is_demo IS
  'Matière de démonstration, préfixée DEMO. N''alimente jamais le moteur réglementaire.';

CREATE INDEX raw_materials_org_idx ON raw_materials (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX raw_materials_category_idx
  ON raw_materials (organization_id, category) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX raw_materials_reference_idx
  ON raw_materials (organization_id, lower(internal_reference))
  WHERE internal_reference IS NOT NULL AND deleted_at IS NULL;

CREATE TRIGGER raw_materials_set_updated_at
  BEFORE UPDATE ON raw_materials FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- documents
-- -----------------------------------------------------------------------------
CREATE TABLE documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind                document_kind NOT NULL,
  storage_key         text NOT NULL,
  original_filename   text NOT NULL,
  mime_type           text NOT NULL,
  byte_size           bigint NOT NULL CHECK (byte_size > 0),
  sha256              text NOT NULL,
  raw_material_id     uuid REFERENCES raw_materials(id) ON DELETE SET NULL,
  uploaded_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT documents_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT documents_storage_key_unique UNIQUE (storage_key)
);

-- Déduplication à l'échelle de l'organisation : le même fichier n'est stocké
-- qu'une fois, et son extraction n'est jamais refaite.
CREATE UNIQUE INDEX documents_org_sha256_idx
  ON documents (organization_id, sha256) WHERE deleted_at IS NULL;

CREATE INDEX documents_org_kind_idx
  ON documents (organization_id, kind) WHERE deleted_at IS NULL;

COMMENT ON COLUMN documents.storage_key IS
  'Clé dans le stockage privé. Jamais exposée telle quelle : l''accès passe par une URL signée de courte durée.';

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY suppliers_select ON suppliers FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY suppliers_insert ON suppliers FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY suppliers_update ON suppliers FOR UPDATE
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY suppliers_delete ON suppliers FOR DELETE
  USING (app.has_role_at_least(organization_id, 'admin'));

ALTER TABLE raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_materials FORCE ROW LEVEL SECURITY;
CREATE POLICY raw_materials_select ON raw_materials FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY raw_materials_insert ON raw_materials FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY raw_materials_update ON raw_materials FOR UPDATE
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY raw_materials_delete ON raw_materials FOR DELETE
  USING (app.has_role_at_least(organization_id, 'admin'));

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY documents_select ON documents FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY documents_insert ON documents FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
-- Un document n'est jamais modifié : on en dépose une nouvelle version.
CREATE POLICY documents_delete ON documents FOR DELETE
  USING (app.has_role_at_least(organization_id, 'admin'));
