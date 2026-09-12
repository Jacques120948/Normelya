import type { DatabaseClient } from '../ports/database'
import { hashIdentifier } from './hashing'

/**
 * Journal d'audit.
 *
 * Les écritures passent par le rôle de service : un utilisateur ne peut pas
 * forger une trace (voir db/roles.sql et les tests d'isolation).
 *
 * Actions tracées, au minimum : FDS importée, FDS validée, champ modifié,
 * produit créé, recette modifiée, analyse effectuée, version de moteur utilisée,
 * étiquette créée, PDF généré, document archivé.
 */
export const AUDIT_ACTIONS = [
  'user.signed_up',
  'user.signed_in',
  'user.signed_out',
  'user.email_verified',
  'user.password_reset',
  'user.deleted',
  'organization.created',
  'organization.updated',
  'organization.member_added',
  'organization.member_removed',
  'organization.member_role_changed',
  'raw_material.created',
  'raw_material.updated',
  'raw_material.archived',
  'supplier.created',
  'supplier.updated',
  'document.uploaded',
  'document.downloaded',
  'document.archived',
  'sds.imported',
  'sds.extracted',
  'sds.field_corrected',
  'sds.validated',
  'sds.version_archived',
  'product.created',
  'product.updated',
  'product.archived',
  'recipe.created',
  'recipe.updated',
  'analysis.requested',
  'analysis.completed',
  'label.created',
  'label.exported',
  'subscription.changed',
  'data.exported',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export type AuditEntry = {
  organizationId: string | null
  actorUserId: string | null
  actorType?: 'user' | 'system' | 'admin'
  action: AuditAction
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
  userAgent?: string | null
}

/**
 * Écrit une trace d'audit.
 *
 * Une trace ne fait jamais échouer l'action métier : si l'écriture échoue, on
 * journalise l'incident côté serveur et on continue. Perdre une trace est
 * regrettable ; bloquer un utilisateur à cause d'une trace l'est davantage.
 */
export async function recordAudit(client: DatabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await client.query(
      `INSERT INTO audit_logs
         (organization_id, actor_user_id, actor_type, action, entity_type, entity_id,
          before, after, ip_hash, user_agent_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.organizationId,
        entry.actorUserId,
        entry.actorType ?? 'user',
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.before === undefined ? null : JSON.stringify(entry.before),
        entry.after === undefined ? null : JSON.stringify(entry.after),
        hashIdentifier(entry.ip),
        hashIdentifier(entry.userAgent),
      ],
    )
  } catch (error) {
    console.error("Échec d'écriture d'une trace d'audit", {
      action: entry.action,
      entityType: entry.entityType,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Compare deux objets et ne conserve que les champs modifiés.
 * Utilisé pour tracer une correction de champ sans recopier tout l'objet.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): { before: Partial<T>; after: Partial<T> } {
  const changedBefore: Partial<T> = {}
  const changedAfter: Partial<T> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of keys) {
    const typedKey = key as keyof T
    if (JSON.stringify(before[typedKey]) !== JSON.stringify(after[typedKey])) {
      changedBefore[typedKey] = before[typedKey]
      changedAfter[typedKey] = after[typedKey]
    }
  }
  return { before: changedBefore, after: changedAfter }
}
