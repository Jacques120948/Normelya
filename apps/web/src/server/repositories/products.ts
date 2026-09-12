import type { Market, NormelyaStatus, ProductType } from '@normelya/core'
import type { DatabaseClient } from '../ports/database'

/**
 * Accès aux produits, à leurs versions et à leurs recettes.
 *
 * Comme partout, chaque requête filtre explicitement sur organization_id, en
 * plus des politiques d'isolation. Ce n'est pas redondant : c'est la première
 * barrière, et elle rend l'intention lisible.
 */

export type ProductRow = {
  id: string
  name: string
  product_type: ProductType
  net_weight_grams: string | null
  container_description: string | null
  status: 'draft' | 'active' | 'archived'
  current_version_id: string | null
  is_demo: boolean
  created_at: Date
  updated_at: Date
  /** Statut de la dernière analyse, ou null si aucune. */
  last_analysis_status: NormelyaStatus | null
  markets: Market[] | null
  ingredient_count: number
  recipe_total: string | null
}

const SELECTION = `
  SELECT
    p.id,
    p.name,
    p.product_type,
    p.net_weight_grams::text,
    p.container_description,
    p.status::text AS status,
    p.current_version_id,
    p.is_demo,
    p.created_at,
    p.updated_at,
    -- Le pilote pg ne sait pas décoder un tableau d'enum : la conversion en
    -- text[] lui rend un vrai tableau plutôt que le littéral « {FR,CH} ».
    v.markets::text[] AS markets,
    (
      SELECT count(*)::int
      FROM recipe_ingredients ri
      JOIN recipes r ON r.id = ri.recipe_id
      WHERE r.product_version_id = v.id
    ) AS ingredient_count,
    (SELECT r.total_percent::text FROM recipes r WHERE r.product_version_id = v.id) AS recipe_total,
    (
      SELECT res.overall_status::text
      FROM regulatory_calculations c
      JOIN regulatory_results res ON res.calculation_id = c.id
      WHERE c.product_id = p.id
      ORDER BY c.created_at DESC
      LIMIT 1
    ) AS last_analysis_status
  FROM products p
  LEFT JOIN product_versions v ON v.id = p.current_version_id
`

export async function listProducts(
  client: DatabaseClient,
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<ProductRow[]> {
  const conditions = ['p.organization_id = $1', 'p.deleted_at IS NULL']
  if (!options.includeArchived) conditions.push("p.status <> 'archived'")

  return client.query<ProductRow>(
    `${SELECTION} WHERE ${conditions.join(' AND ')} ORDER BY p.updated_at DESC`,
    [organizationId],
  )
}

export async function findProduct(
  client: DatabaseClient,
  organizationId: string,
  id: string,
): Promise<ProductRow | null> {
  return client.queryOne<ProductRow>(
    `${SELECTION} WHERE p.organization_id = $1 AND p.id = $2 AND p.deleted_at IS NULL`,
    [organizationId, id],
  )
}

export type RecipeIngredientRow = {
  id: string
  raw_material_id: string
  raw_material_name: string
  category: string
  sds_version_id: string | null
  sds_version_label: string | null
  sds_status: string | null
  percent: string
  role: string
  position: number
}

export async function listRecipeIngredients(
  client: DatabaseClient,
  organizationId: string,
  productVersionId: string,
): Promise<RecipeIngredientRow[]> {
  return client.query<RecipeIngredientRow>(
    `SELECT ri.id, ri.raw_material_id, m.name AS raw_material_name, m.category::text AS category,
            ri.sds_version_id, v.version_label AS sds_version_label, v.status::text AS sds_status,
            ri.percent::text, ri.role::text, ri.position
     FROM recipe_ingredients ri
     JOIN recipes r ON r.id = ri.recipe_id
     JOIN raw_materials m ON m.id = ri.raw_material_id
     LEFT JOIN sds_versions v ON v.id = ri.sds_version_id
     WHERE r.product_version_id = $2 AND ri.organization_id = $1
     ORDER BY ri.position`,
    [organizationId, productVersionId],
  )
}

export type SelectableMaterial = {
  id: string
  name: string
  category: string
  /** Version de fiche validée et active, si elle existe. */
  validated_sds_version_id: string | null
  validated_sds_label: string | null
}

/**
 * Matières sélectionnables dans une recette, avec leur version de fiche validée.
 *
 * Une matière sans fiche validée reste sélectionnable : l'artisan construit sa
 * recette avant d'avoir tous ses documents. C'est l'analyse qui exigera les
 * fiches, pas la saisie.
 */
export async function listSelectableMaterials(
  client: DatabaseClient,
  organizationId: string,
): Promise<SelectableMaterial[]> {
  return client.query<SelectableMaterial>(
    `SELECT m.id, m.name, m.category::text AS category,
            v.id AS validated_sds_version_id, v.version_label AS validated_sds_label
     FROM raw_materials m
     LEFT JOIN safety_data_sheets f
            ON f.raw_material_id = m.id AND f.deleted_at IS NULL
     LEFT JOIN sds_versions v
            ON v.safety_data_sheet_id = f.id
           AND v.status = 'validated'
           AND v.archived_at IS NULL
     WHERE m.organization_id = $1 AND m.deleted_at IS NULL AND m.is_archived = false
     ORDER BY m.category, m.name`,
    [organizationId],
  )
}

export type ProductVersionRow = {
  id: string
  version_number: number
  name_snapshot: string
  markets: Market[]
  is_locked: boolean
  locked_at: Date | null
  created_at: Date
}

export async function listProductVersions(
  client: DatabaseClient,
  organizationId: string,
  productId: string,
): Promise<ProductVersionRow[]> {
  return client.query<ProductVersionRow>(
    `SELECT id, version_number, name_snapshot, markets::text[] AS markets,
            is_locked, locked_at, created_at
     FROM product_versions
     WHERE organization_id = $1 AND product_id = $2
     ORDER BY version_number DESC`,
    [organizationId, productId],
  )
}
