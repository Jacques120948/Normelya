import { AppError, checkQuota, type PlanCode, type QuotaMetric } from '@normelya/core'
import type { DatabaseClient } from '../ports/database'

/**
 * Contrôle des quotas d'offre.
 *
 * Vérifié côté serveur avant toute écriture concernée. L'interface peut masquer
 * un bouton ; elle ne fait jamais respecter une limite.
 */

/** Décompte réel, requêté en base plutôt que lu dans un compteur potentiellement obsolète. */
export async function currentUsage(
  client: DatabaseClient,
  organizationId: string,
  metric: QuotaMetric,
): Promise<number> {
  switch (metric) {
    case 'active_products': {
      const row = await client.queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM products
         WHERE organization_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [organizationId],
      )
      return Number(row?.total ?? 0)
    }
    case 'members': {
      const row = await client.queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM organization_members WHERE organization_id = $1`,
        [organizationId],
      )
      return Number(row?.total ?? 0)
    }
    case 'storage_bytes': {
      const row = await client.queryOne<{ total: string }>(
        `SELECT coalesce(sum(byte_size), 0)::text AS total FROM documents
         WHERE organization_id = $1 AND deleted_at IS NULL`,
        [organizationId],
      )
      return Number(row?.total ?? 0)
    }
    case 'ai_extractions': {
      const row = await client.queryOne<{ value: string }>(
        `SELECT value::text FROM usage_counters
         WHERE organization_id = $1 AND metric = 'ai_extractions'
           AND period_start = date_trunc('month', now())::date`,
        [organizationId],
      )
      return Number(row?.value ?? 0)
    }
  }
}

/**
 * Vérifie qu'une écriture supplémentaire est permise par l'offre.
 * Lève une erreur porteuse d'un message destiné à l'utilisateur.
 */
export async function assertWithinQuota(
  client: DatabaseClient,
  input: { organizationId: string; plan: PlanCode; metric: QuotaMetric },
): Promise<void> {
  const used = await currentUsage(client, input.organizationId, input.metric)
  const verdict = checkQuota(input.plan, input.metric, used)
  if (!verdict.allowed) {
    throw AppError.quotaExceeded(verdict.message, {
      metric: input.metric,
      limit: verdict.limit,
      current: verdict.current,
    })
  }
}

/** Incrémente un compteur périodique (extractions assistées par IA). */
export async function incrementMonthlyCounter(
  client: DatabaseClient,
  organizationId: string,
  metric: QuotaMetric,
  by = 1,
): Promise<void> {
  await client.query(
    `INSERT INTO usage_counters (organization_id, metric, period_start, value)
     VALUES ($1, $2, date_trunc('month', now())::date, $3)
     ON CONFLICT (organization_id, metric, period_start)
     DO UPDATE SET value = usage_counters.value + EXCLUDED.value, updated_at = now()`,
    [organizationId, metric, by],
  )
}
