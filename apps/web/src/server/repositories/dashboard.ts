import type { DatabaseClient } from '../ports/database'

/**
 * Chiffres du tableau de bord.
 *
 * Tous les compteurs sont calculés en une seule requête, sur des données
 * réelles. Aucune valeur n'est estimée ni mise en cache : un tableau de bord qui
 * ment sur l'état d'un dossier est pire que pas de tableau de bord.
 */
export type DashboardCounts = {
  /** Produits dont la dernière analyse s'est achevée sans réserve. */
  analyzedProducts: number
  /** Produits dont l'analyse demande une vérification, ou sans analyse. */
  productsToCheck: number
  /** Versions de FDS déposées mais pas encore validées par un humain. */
  documentsToUpdate: number
  rawMaterials: number
}

export async function dashboardCounts(
  client: DatabaseClient,
  organizationId: string,
): Promise<DashboardCounts> {
  const row = await client.queryOne<{
    analyzed: string
    to_check: string
    documents: string
    materials: string
  }>(
    `WITH dernier_resultat AS (
       SELECT DISTINCT ON (c.product_id)
              c.product_id, r.overall_status
       FROM regulatory_calculations c
       JOIN regulatory_results r ON r.calculation_id = c.id
       WHERE c.organization_id = $1
       ORDER BY c.product_id, c.created_at DESC
     )
     SELECT
       (SELECT count(*)::text FROM dernier_resultat WHERE overall_status = 'completed')
         AS analyzed,
       (SELECT count(*)::text
          FROM products p
          LEFT JOIN dernier_resultat d ON d.product_id = p.id
          WHERE p.organization_id = $1
            AND p.deleted_at IS NULL
            AND p.status <> 'archived'
            AND (d.overall_status IS NULL OR d.overall_status <> 'completed'))
         AS to_check,
       (SELECT count(*)::text FROM sds_versions
          WHERE organization_id = $1 AND status IN ('imported', 'needs_review'))
         AS documents,
       (SELECT count(*)::text FROM raw_materials
          WHERE organization_id = $1 AND deleted_at IS NULL AND is_archived = false)
         AS materials`,
    [organizationId],
  )

  return {
    analyzedProducts: Number(row?.analyzed ?? 0),
    productsToCheck: Number(row?.to_check ?? 0),
    documentsToUpdate: Number(row?.documents ?? 0),
    rawMaterials: Number(row?.materials ?? 0),
  }
}

export type RecentProduct = {
  id: string
  name: string
  product_type: string
  status: string
  overall_status: string | null
  updated_at: Date
}

export async function recentProducts(
  client: DatabaseClient,
  organizationId: string,
  limit = 5,
): Promise<RecentProduct[]> {
  return client.query<RecentProduct>(
    `SELECT p.id, p.name, p.product_type::text, p.status::text, p.updated_at,
            (SELECT r.overall_status::text
             FROM regulatory_calculations c
             JOIN regulatory_results r ON r.calculation_id = c.id
             WHERE c.product_id = p.id
             ORDER BY c.created_at DESC
             LIMIT 1) AS overall_status
     FROM products p
     WHERE p.organization_id = $1 AND p.deleted_at IS NULL
     ORDER BY p.updated_at DESC
     LIMIT $2`,
    [organizationId, limit],
  )
}

export type OpenNotification = {
  id: string
  type: string
  severity: 'info' | 'warning' | 'action'
  title: string
  body: string | null
  created_at: Date
}

export async function openNotifications(
  client: DatabaseClient,
  organizationId: string,
  limit = 5,
): Promise<OpenNotification[]> {
  return client.query<OpenNotification>(
    `SELECT id, type::text, severity, title, body, created_at
     FROM notifications
     WHERE organization_id = $1 AND resolved_at IS NULL
     ORDER BY
       CASE severity WHEN 'action' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $2`,
    [organizationId, limit],
  )
}

export type RecentDocument = {
  id: string
  kind: string
  original_filename: string
  byte_size: string
  created_at: Date
  raw_material_name: string | null
}

export async function recentDocuments(
  client: DatabaseClient,
  organizationId: string,
  limit = 5,
): Promise<RecentDocument[]> {
  return client.query<RecentDocument>(
    `SELECT d.id, d.kind::text, d.original_filename, d.byte_size::text, d.created_at,
            m.name AS raw_material_name
     FROM documents d
     LEFT JOIN raw_materials m ON m.id = d.raw_material_id
     WHERE d.organization_id = $1 AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [organizationId, limit],
  )
}
