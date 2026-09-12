-- =============================================================================
-- 0008 — Centre de conformité, journal d'audit, coût de revient, lots
-- =============================================================================

CREATE TYPE notification_type AS ENUM (
  'sds_new_version',        -- une nouvelle version de FDS est disponible
  'product_uses_old_sds',   -- un produit s'appuie sur une version archivée
  'missing_information',    -- une donnée nécessaire manque
  'reanalysis_needed',      -- le résultat changerait avec le moteur actuel
  'document_to_check',
  'system'
);
CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'action');
CREATE TYPE audit_actor_type AS ENUM ('user', 'system', 'admin');
CREATE TYPE cost_category AS ENUM (
  'material', 'container', 'packaging', 'wick', 'label', 'other'
);

CREATE TABLE notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type              notification_type NOT NULL,
  severity          notification_severity NOT NULL DEFAULT 'info',
  title             text NOT NULL,
  body              text,
  product_id        uuid REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id   uuid REFERENCES raw_materials(id) ON DELETE CASCADE,
  sds_version_id    uuid REFERENCES sds_versions(id) ON DELETE CASCADE,
  read_at           timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_org_idx
  ON notifications (organization_id, created_at DESC);
CREATE INDEX notifications_open_idx
  ON notifications (organization_id, severity) WHERE resolved_at IS NULL;

-- -----------------------------------------------------------------------------
-- audit_logs — APPEND-ONLY
--
-- Trace au minimum : FDS importée, FDS validée, champ modifié, produit créé,
-- recette modifiée, analyse effectuée, version de moteur utilisée, étiquette
-- créée, PDF généré, document archivé.
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type        audit_actor_type NOT NULL DEFAULT 'user',
  action            text NOT NULL,
  entity_type       text NOT NULL,
  entity_id         uuid,
  before            jsonb,
  after             jsonb,
  ip_hash           text,
  user_agent_hash   text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_org_idx ON audit_logs (organization_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_user_id, created_at DESC);

SELECT app.make_append_only('audit_logs');

-- -----------------------------------------------------------------------------
-- Coût de revient — strictement indépendant du moteur réglementaire
-- -----------------------------------------------------------------------------
CREATE TABLE cost_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_version_id  uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  category            cost_category NOT NULL,
  label               text NOT NULL,
  raw_material_id     uuid REFERENCES raw_materials(id) ON DELETE SET NULL,
  quantity            numeric(12,4) NOT NULL CHECK (quantity >= 0),
  unit                text NOT NULL,
  unit_cost_cents     integer NOT NULL CHECK (unit_cost_cents >= 0),
  total_cost_cents    integer NOT NULL CHECK (total_cost_cents >= 0),
  position            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cost_items_version_idx ON cost_items (product_version_id, position);

CREATE TRIGGER cost_items_set_updated_at
  BEFORE UPDATE ON cost_items FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE product_pricing (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_version_id    uuid NOT NULL UNIQUE REFERENCES product_versions(id) ON DELETE CASCADE,
  selling_price_cents   integer NOT NULL CHECK (selling_price_cents >= 0),
  vat_rate              numeric(5,2) CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  currency              text NOT NULL DEFAULT 'EUR',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER product_pricing_set_updated_at
  BEFORE UPDATE ON product_pricing FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- Lots et traçabilité — structure préparée, fonctionnalité prévue en V2
-- -----------------------------------------------------------------------------
CREATE TABLE lots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_version_id  uuid NOT NULL REFERENCES product_versions(id) ON DELETE RESTRICT,
  lot_code            text NOT NULL,
  produced_on         date NOT NULL,
  quantity            integer CHECK (quantity IS NULL OR quantity > 0),
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lots_code_unique UNIQUE (organization_id, lot_code)
);

CREATE TABLE lot_materials (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lot_id              uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  raw_material_id     uuid NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  sds_version_id      uuid REFERENCES sds_versions(id) ON DELETE RESTRICT,
  supplier_lot_code   text,
  quantity            numeric(12,4) CHECK (quantity IS NULL OR quantity > 0),
  unit                text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lot_materials_lot_idx ON lot_materials (lot_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_select ON notifications FOR SELECT
  USING (app.is_member_of(organization_id));
-- Un utilisateur peut marquer une alerte comme lue ou résolue, pas la créer.
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (app.is_member_of(organization_id))
  WITH CHECK (app.is_member_of(organization_id));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
-- Lecture réservée aux administrateurs de l'organisation ; écriture par le seul
-- rôle de service, pour qu'un utilisateur ne puisse pas forger une trace.
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (organization_id IS NOT NULL AND app.has_role_at_least(organization_id, 'admin'));

ALTER TABLE cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_items FORCE ROW LEVEL SECURITY;
CREATE POLICY cost_items_select ON cost_items FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY cost_items_write ON cost_items FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing FORCE ROW LEVEL SECURITY;
CREATE POLICY product_pricing_select ON product_pricing FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY product_pricing_write ON product_pricing FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots FORCE ROW LEVEL SECURITY;
CREATE POLICY lots_select ON lots FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY lots_write ON lots FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE lot_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_materials FORCE ROW LEVEL SECURITY;
CREATE POLICY lot_materials_select ON lot_materials FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY lot_materials_write ON lot_materials FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
