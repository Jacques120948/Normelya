-- =============================================================================
-- 0006 — Produits, versions de produit, recettes
--
-- Une analyse réglementaire porte sur une VERSION de produit, jamais sur un
-- produit modifiable. Dès qu'une analyse s'y rattache, la version est verrouillée
-- et toute modification crée une nouvelle version. C'est ce qui rend un résultat
-- rejouable à l'identique des années plus tard.
-- =============================================================================

CREATE TYPE product_type AS ENUM ('candle', 'wax_melt');
CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE market_code AS ENUM ('FR', 'CH');
CREATE TYPE ingredient_role AS ENUM ('wax', 'fragrance', 'dye', 'additive', 'other');

CREATE TABLE products (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  product_type            product_type NOT NULL,
  net_weight_grams        numeric(9,3) CHECK (net_weight_grams IS NULL OR net_weight_grams > 0),
  container_description   text,
  status                  product_status NOT NULL DEFAULT 'draft',
  current_version_id      uuid,
  is_demo                 boolean NOT NULL DEFAULT false,
  created_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz,
  CONSTRAINT products_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX products_org_idx ON products (organization_id) WHERE deleted_at IS NULL;
-- Sert au décompte des produits actifs pour les quotas d'offre.
CREATE INDEX products_active_idx
  ON products (organization_id) WHERE status = 'active' AND deleted_at IS NULL;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- product_versions — recette figée + marchés visés
-- -----------------------------------------------------------------------------
CREATE TABLE product_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_number      integer NOT NULL CHECK (version_number > 0),
  name_snapshot       text NOT NULL,
  net_weight_grams    numeric(9,3),
  markets             market_code[] NOT NULL DEFAULT '{}',
  is_locked           boolean NOT NULL DEFAULT false,
  locked_at           timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_versions_unique UNIQUE (product_id, version_number),
  CONSTRAINT product_versions_markets_not_empty CHECK (cardinality(markets) > 0),
  CONSTRAINT product_versions_lock_coherent CHECK (is_locked = (locked_at IS NOT NULL))
);

COMMENT ON COLUMN product_versions.is_locked IS
  'Verrouillée dès qu''une analyse réglementaire s''y rattache. Toute modification crée alors une nouvelle version.';

CREATE INDEX product_versions_product_idx ON product_versions (product_id, version_number DESC);

ALTER TABLE products
  ADD CONSTRAINT products_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES product_versions(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- recipes — une recette par version de produit
-- -----------------------------------------------------------------------------
CREATE TABLE recipes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_version_id  uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  basis              text NOT NULL DEFAULT 'mass_percent',
  total_percent       numeric(9,6) NOT NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipes_version_unique UNIQUE (product_version_id),
  -- Le total doit valoir exactement 100 %. Aucune tolérance implicite.
  CONSTRAINT recipes_total_is_100 CHECK (total_percent = 100),
  CONSTRAINT recipes_basis_supported CHECK (basis = 'mass_percent')
);

CREATE TABLE recipe_ingredients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipe_id         uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  raw_material_id   uuid NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  -- Version EXACTE de la FDS utilisée au moment de l'analyse. Jamais recalculée.
  sds_version_id    uuid REFERENCES sds_versions(id) ON DELETE RESTRICT,
  percent           numeric(9,6) NOT NULL CHECK (percent > 0 AND percent <= 100),
  role              ingredient_role NOT NULL,
  position          integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipe_ingredients_unique UNIQUE (recipe_id, raw_material_id)
);

COMMENT ON COLUMN recipe_ingredients.sds_version_id IS
  'Version de FDS effectivement utilisée. Une nouvelle version fournisseur ne modifie jamais cette référence.';

CREATE INDEX recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id, position);
CREATE INDEX recipe_ingredients_material_idx ON recipe_ingredients (raw_material_id);
CREATE INDEX recipe_ingredients_sds_idx ON recipe_ingredients (sds_version_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_select ON products FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY products_insert ON products FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY products_update ON products FOR UPDATE
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
CREATE POLICY products_delete ON products FOR DELETE
  USING (app.has_role_at_least(organization_id, 'admin'));

ALTER TABLE product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY product_versions_select ON product_versions FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY product_versions_insert ON product_versions FOR INSERT
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
-- Seul le verrouillage peut être modifié ; une version verrouillée est figée.
CREATE POLICY product_versions_update ON product_versions FOR UPDATE
  USING (app.has_role_at_least(organization_id, 'member') AND NOT is_locked)
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;
CREATE POLICY recipes_select ON recipes FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY recipes_write ON recipes FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY recipe_ingredients_select ON recipe_ingredients FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY recipe_ingredients_write ON recipe_ingredients FOR ALL
  USING (app.has_role_at_least(organization_id, 'member'))
  WITH CHECK (app.has_role_at_least(organization_id, 'member'));
