import {
  AppError,
  err,
  ok,
  rawMaterialSchema,
  type RawMaterialInput,
  type RequestContext,
  type Result,
} from '@normelya/core'
import type { Database } from '../ports/database'
import { recordAudit, diffFields } from '../security/audit'
import { requireRole } from '../security/request-context'
import {
  findOrCreateSupplier,
  findRawMaterial,
  type RawMaterialRow,
} from '../repositories/raw-materials'

/**
 * Cas d'usage des matières premières.
 *
 * Chaque écriture : vérification du rôle, validation du contenu, exécution dans
 * le contexte de l'utilisateur (donc sous RLS), puis trace d'audit.
 */

export type RawMaterialDeps = {
  db: Database
  serviceDb: Database
}

export type CreateInput = RawMaterialInput & {
  /** Nom libre : le fournisseur est créé s'il n'existe pas encore. */
  supplierName?: string
}

export async function createRawMaterial(
  deps: RawMaterialDeps,
  context: RequestContext,
  input: CreateInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<{ id: string }, AppError>> {
  requireRole(context, 'member')

  const analyse = rawMaterialSchema.safeParse(input)
  if (!analyse.success) {
    return err(
      AppError.validation('Certaines informations sont incomplètes.', {
        issues: analyse.error.issues,
      }),
    )
  }

  const donnees = analyse.data

  try {
    const id = await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        const supplierId =
          donnees.supplierId ??
          (input.supplierName
            ? await findOrCreateSupplier(client, context.organizationId, input.supplierName)
            : null)

        const cree = await client.queryOne<{ id: string }>(
          `INSERT INTO raw_materials
             (organization_id, supplier_id, name, internal_reference, category,
              purchase_price_cents, purchase_quantity, purchase_unit, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            context.organizationId,
            supplierId,
            donnees.name,
            donnees.internalReference || null,
            donnees.category,
            donnees.purchasePriceCents ?? null,
            donnees.purchaseQuantity ?? null,
            donnees.purchaseUnit ?? null,
            donnees.notes || null,
            context.userId,
          ],
        )
        if (!cree) throw AppError.validation("La matière première n'a pas pu être créée.")
        return cree.id
      },
    )

    await deps.serviceDb.transaction((client) =>
      recordAudit(client, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'raw_material.created',
        entityType: 'raw_material',
        entityId: id,
        after: { name: donnees.name, category: donnees.category },
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    )

    return ok({ id })
  } catch (error) {
    return err(traduireErreurEcriture(error, donnees.internalReference))
  }
}

export async function updateRawMaterial(
  deps: RawMaterialDeps,
  context: RequestContext,
  id: string,
  input: CreateInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<void, AppError>> {
  requireRole(context, 'member')

  const analyse = rawMaterialSchema.safeParse(input)
  if (!analyse.success) {
    return err(
      AppError.validation('Certaines informations sont incomplètes.', {
        issues: analyse.error.issues,
      }),
    )
  }
  const donnees = analyse.data

  try {
    const modification = await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        const avant = await findRawMaterial(client, context.organizationId, id)
        if (!avant) throw AppError.notFound("Cette matière première n'existe pas.")

        const supplierId =
          donnees.supplierId ??
          (input.supplierName
            ? await findOrCreateSupplier(client, context.organizationId, input.supplierName)
            : avant.supplier_id)

        await client.query(
          `UPDATE raw_materials
           SET supplier_id = $3, name = $4, internal_reference = $5, category = $6,
               purchase_price_cents = $7, purchase_quantity = $8, purchase_unit = $9, notes = $10
           WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`,
          [
            context.organizationId,
            id,
            supplierId,
            donnees.name,
            donnees.internalReference || null,
            donnees.category,
            donnees.purchasePriceCents ?? null,
            donnees.purchaseQuantity ?? null,
            donnees.purchaseUnit ?? null,
            donnees.notes || null,
          ],
        )

        // Seuls les champs réellement modifiés sont tracés.
        return diffFields(
          { name: avant.name, category: avant.category, reference: avant.internal_reference },
          {
            name: donnees.name,
            category: donnees.category,
            reference: donnees.internalReference || null,
          },
        )
      },
    )

    await deps.serviceDb.transaction((client) =>
      recordAudit(client, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'raw_material.updated',
        entityType: 'raw_material',
        entityId: id,
        before: modification.before,
        after: modification.after,
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    )

    return ok(undefined)
  } catch (error) {
    return err(traduireErreurEcriture(error, donnees.internalReference))
  }
}

/**
 * Archivage.
 *
 * Une matière n'est jamais supprimée : elle peut être citée par une recette et
 * par une analyse déjà produite. L'archivage la retire des listes sans rompre
 * la traçabilité.
 */
export async function archiveRawMaterial(
  deps: RawMaterialDeps,
  context: RequestContext,
  id: string,
  archiver: boolean,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<void, AppError>> {
  requireRole(context, 'member')

  const modifiees = await deps.db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    async (client) => {
      const rows = await client.query<{ id: string }>(
        `UPDATE raw_materials SET is_archived = $3
         WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [context.organizationId, id, archiver],
      )
      return rows.length
    },
  )

  if (modifiees === 0) return err(AppError.notFound("Cette matière première n'existe pas."))

  await deps.serviceDb.transaction((client) =>
    recordAudit(client, {
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: 'raw_material.archived',
      entityType: 'raw_material',
      entityId: id,
      after: { isArchived: archiver },
      ip: meta.ip,
      userAgent: meta.userAgent,
    }),
  )

  return ok(undefined)
}

export type { RawMaterialRow }

function traduireErreurEcriture(erreur: unknown, reference?: string | null): AppError {
  if (erreur instanceof AppError) return erreur

  const message = erreur instanceof Error ? erreur.message : String(erreur)

  if (message.includes('raw_materials_reference_idx')) {
    return new AppError(
      'CONFLICT',
      `La référence « ${reference ?? ''} » est déjà utilisée par une autre matière première.`,
    )
  }
  if (message.includes('raw_materials_purchase_coherent')) {
    return AppError.validation(
      'Pour enregistrer un prix, indiquez aussi la quantité et son unité.',
    )
  }
  if (message.includes('row-level security')) {
    return AppError.forbidden()
  }

  console.error('Écriture de matière première refusée', { message })
  return new AppError('INTERNAL', 'Une erreur est survenue. Réessayez dans un instant.')
}
