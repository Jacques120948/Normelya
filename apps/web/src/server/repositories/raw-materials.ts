import type { RawMaterialCategory } from '@normelya/core'
import type { DatabaseClient } from '../ports/database'

/**
 * Accès aux matières premières.
 *
 * Chaque requête filtre explicitement sur organization_id, alors même que les
 * politiques RLS le feraient. Ce n'est pas une redondance inutile : c'est la
 * première barrière, celle qui rend l'intention visible à la lecture du code.
 */

/** État du dossier documentaire d'une matière. Jamais un jugement réglementaire. */
export type SdsState = 'missing' | 'needs_review' | 'validated'

export type RawMaterialRow = {
  id: string
  name: string
  category: RawMaterialCategory
  internal_reference: string | null
  supplier_id: string | null
  supplier_name: string | null
  purchase_price_cents: number | null
  purchase_quantity: string | null
  purchase_unit: string | null
  is_archived: boolean
  is_demo: boolean
  notes: string | null
  created_at: Date
  document_count: number
  sds_state: SdsState
}

const SELECTION = `
  SELECT
    m.id,
    m.name,
    m.category,
    m.internal_reference,
    m.supplier_id,
    s.name AS supplier_name,
    m.purchase_price_cents,
    m.purchase_quantity::text AS purchase_quantity,
    m.purchase_unit::text AS purchase_unit,
    m.is_archived,
    m.is_demo,
    m.notes,
    m.created_at,
    (
      SELECT count(*)::int FROM documents d
      WHERE d.raw_material_id = m.id AND d.deleted_at IS NULL
    ) AS document_count,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM safety_data_sheets sheet
        JOIN sds_versions v ON v.safety_data_sheet_id = sheet.id
        WHERE sheet.raw_material_id = m.id
          AND sheet.deleted_at IS NULL
          AND v.status = 'validated'
          AND v.archived_at IS NULL
      ) THEN 'validated'
      WHEN EXISTS (
        SELECT 1 FROM safety_data_sheets sheet
        JOIN sds_versions v ON v.safety_data_sheet_id = sheet.id
        WHERE sheet.raw_material_id = m.id AND sheet.deleted_at IS NULL
      ) THEN 'needs_review'
      ELSE 'missing'
    END AS sds_state
  FROM raw_materials m
  LEFT JOIN suppliers s ON s.id = m.supplier_id AND s.deleted_at IS NULL
`

export type ListFilters = {
  category?: RawMaterialCategory
  search?: string
  includeArchived?: boolean
}

export async function listRawMaterials(
  client: DatabaseClient,
  organizationId: string,
  filters: ListFilters = {},
): Promise<RawMaterialRow[]> {
  const conditions = ['m.organization_id = $1', 'm.deleted_at IS NULL']
  const params: unknown[] = [organizationId]

  if (!filters.includeArchived) conditions.push('m.is_archived = false')

  if (filters.category) {
    params.push(filters.category)
    conditions.push(`m.category = $${params.length}`)
  }

  if (filters.search) {
    params.push(`%${filters.search}%`)
    // La recherche porte sur le nom, la référence interne et le fournisseur.
    conditions.push(
      `(m.name ILIKE $${params.length}
        OR m.internal_reference ILIKE $${params.length}
        OR s.name ILIKE $${params.length})`,
    )
  }

  return client.query<RawMaterialRow>(
    `${SELECTION} WHERE ${conditions.join(' AND ')} ORDER BY m.name ASC`,
    params as never,
  )
}

export async function findRawMaterial(
  client: DatabaseClient,
  organizationId: string,
  id: string,
): Promise<RawMaterialRow | null> {
  return client.queryOne<RawMaterialRow>(
    `${SELECTION} WHERE m.organization_id = $1 AND m.id = $2 AND m.deleted_at IS NULL`,
    [organizationId, id],
  )
}

export type RawMaterialCounts = {
  total: number
  byCategory: Record<string, number>
  missingSds: number
}

export async function countRawMaterials(
  client: DatabaseClient,
  organizationId: string,
): Promise<RawMaterialCounts> {
  const rows = await client.query<{ category: string; total: string }>(
    `SELECT category::text, count(*)::text AS total
     FROM raw_materials
     WHERE organization_id = $1 AND deleted_at IS NULL AND is_archived = false
     GROUP BY category`,
    [organizationId],
  )

  const byCategory: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    const valeur = Number(row.total)
    byCategory[row.category] = valeur
    total += valeur
  }

  const manquantes = await client.queryOne<{ total: string }>(
    `SELECT count(*)::text AS total
     FROM raw_materials m
     WHERE m.organization_id = $1
       AND m.deleted_at IS NULL
       AND m.is_archived = false
       AND NOT EXISTS (
         SELECT 1 FROM safety_data_sheets sheet
         JOIN sds_versions v ON v.safety_data_sheet_id = sheet.id
         WHERE sheet.raw_material_id = m.id
           AND sheet.deleted_at IS NULL
           AND v.status = 'validated'
           AND v.archived_at IS NULL
       )`,
    [organizationId],
  )

  return { total, byCategory, missingSds: Number(manquantes?.total ?? 0) }
}

export async function listSuppliers(
  client: DatabaseClient,
  organizationId: string,
): Promise<Array<{ id: string; name: string }>> {
  return client.query<{ id: string; name: string }>(
    `SELECT id, name FROM suppliers
     WHERE organization_id = $1 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [organizationId],
  )
}

/** Crée le fournisseur s'il n'existe pas encore, sinon renvoie l'existant. */
export async function findOrCreateSupplier(
  client: DatabaseClient,
  organizationId: string,
  name: string,
): Promise<string | null> {
  const propre = name.trim()
  if (propre.length === 0) return null

  const existant = await client.queryOne<{ id: string }>(
    `SELECT id FROM suppliers
     WHERE organization_id = $1 AND lower(name) = lower($2) AND deleted_at IS NULL`,
    [organizationId, propre],
  )
  if (existant) return existant.id

  const cree = await client.queryOne<{ id: string }>(
    `INSERT INTO suppliers (organization_id, name) VALUES ($1, $2) RETURNING id`,
    [organizationId, propre],
  )
  return cree?.id ?? null
}
