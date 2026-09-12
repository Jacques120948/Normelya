import {
  AppError,
  canonicalJson,
  err,
  ok,
  VALIDATION_STATEMENT,
  validateSdsSchema,
  type RequestContext,
  type Result,
  type ValidatedSdsPayload,
} from '@normelya/core'
import type { Database } from '../ports/database'
import { recordAudit } from '../security/audit'
import { requireRole } from '../security/request-context'
import { hashIdentifier, sha256Hex } from '../security/hashing'

/**
 * Validation humaine d'une fiche de données de sécurité.
 *
 * C'est la brique juridique du produit. Trois choses s'y produisent, dans cet
 * ordre, et aucune ne peut être sautée :
 *
 * 1. L'attestation est enregistrée : qui a validé, quand, sur quelles données
 *    exactement. L'empreinte scelle le contenu validé, de sorte qu'une
 *    modification ultérieure soit détectable. La table est append-only.
 *
 * 2. La version précédente est archivée, jamais supprimée. L'archivage précède
 *    le passage en validé : la base n'autorise qu'une seule version faisant
 *    autorité par fiche.
 *
 * 3. Les données validées deviennent la source de vérité. Ce sont les seules
 *    que le moteur réglementaire acceptera de consommer. Les produits qui
 *    s'appuyaient sur la version archivée sont signalés, mais aucune analyse
 *    n'est recalculée automatiquement : l'utilisateur décide.
 */

export type SdsValidationDeps = {
  db: Database
  serviceDb: Database
}

export type Attestant = {
  fullName: string | null
  email: string
}

export type ValidationOutcome = {
  sdsVersionId: string
  attestationId: string
  /** Empreinte des données validées, affichée sur le dossier produit. */
  dataHash: string
  archivedVersionId: string | null
  /** Produits qui s'appuyaient sur la version archivée. */
  affectedProductIds: string[]
}

export async function validateSdsVersion(
  deps: SdsValidationDeps,
  context: RequestContext,
  attestant: Attestant,
  input: {
    sdsVersionId: string
    payload: unknown
    confirmed: unknown
  },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<ValidationOutcome, AppError>> {
  requireRole(context, 'member')

  const analyse = validateSdsSchema.safeParse({
    payload: input.payload,
    confirmed: input.confirmed,
  })
  if (!analyse.success) {
    return err(
      AppError.validation('La fiche ne peut pas être validée en l’état.', {
        issues: analyse.error.issues,
      }),
    )
  }

  const payload: ValidatedSdsPayload = analyse.data.payload

  // L'empreinte porte sur une sérialisation canonique : deux saisies
  // équivalentes produisent la même empreinte, ce qui est la condition pour
  // qu'elle prouve quelque chose.
  const dataHash = sha256Hex(canonicalJson(payload))

  try {
    return await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        const version = await client.queryOne<{
          id: string
          safety_data_sheet_id: string
          status: string
        }>(
          `SELECT id, safety_data_sheet_id, status::text
           FROM sds_versions
           WHERE organization_id = $1 AND id = $2`,
          [context.organizationId, input.sdsVersionId],
        )
        if (!version) return err(AppError.notFound("Cette fiche n'existe pas."))
        if (version.status === 'validated') {
          return err(
            new AppError('CONFLICT', 'Cette version a déjà été validée. Importez une nouvelle version pour la corriger.'),
          )
        }

        // 1. Attestation, enregistrée avant toute écriture des données.
        const attestation = await client.queryOne<{ id: string }>(
          `INSERT INTO validation_attestations
             (organization_id, user_id, scope, entity_type, entity_id, data_hash,
              statement_text, attested_by_name, attested_by_email, ip_hash, user_agent_hash)
           VALUES ($1, $2, 'sds_version', 'sds_version', $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            context.organizationId,
            context.userId,
            input.sdsVersionId,
            dataHash,
            VALIDATION_STATEMENT,
            attestant.fullName,
            attestant.email,
            hashIdentifier(meta.ip),
            hashIdentifier(meta.userAgent),
          ],
        )
        if (!attestation) {
          return err(new AppError('INTERNAL', 'La validation n’a pas pu être enregistrée.'))
        }

        // 2. Archivage de la version précédente.
        //
        // Il précède le passage en validé : la base n'autorise qu'une seule
        // version validée et non archivée par fiche. Inverser l'ordre viole
        // cette garantie, qui est précisément ce qui empêche deux versions de
        // faire autorité en même temps.
        const precedente = await client.queryOne<{ id: string }>(
          `SELECT id FROM sds_versions
           WHERE safety_data_sheet_id = $1 AND id <> $2
             AND status = 'validated' AND archived_at IS NULL`,
          [version.safety_data_sheet_id, input.sdsVersionId],
        )

        let produitsConcernes: string[] = []
        if (precedente) {
          await client.query(
            `UPDATE sds_versions SET status = 'archived', archived_at = now() WHERE id = $1`,
            [precedente.id],
          )

          const lignes = await client.query<{ product_id: string }>(
            `SELECT DISTINCT pv.product_id
             FROM recipe_ingredients ri
             JOIN recipes r ON r.id = ri.recipe_id
             JOIN product_versions pv ON pv.id = r.product_version_id
             WHERE ri.sds_version_id = $1`,
            [precedente.id],
          )
          produitsConcernes = lignes.map((ligne) => ligne.product_id)
        }

        // 3. Données validées.
        await client.query(
          `UPDATE sds_versions
           SET validated_payload = $3,
               validated_by = $4,
               validated_at = now(),
               status = 'validated',
               version_label = $5,
               revision_date = $6,
               language = $7,
               flash_point_celsius = $8
           WHERE organization_id = $1 AND id = $2`,
          [
            context.organizationId,
            input.sdsVersionId,
            JSON.stringify(payload),
            context.userId,
            payload.versionLabel,
            payload.revisionDate || null,
            payload.language || null,
            payload.flashPointCelsius,
          ],
        )

        // La composition est réécrite intégralement : elle reflète la saisie
        // validée, pas la lecture automatique.
        await client.query(`DELETE FROM sds_substances WHERE sds_version_id = $1`, [
          input.sdsVersionId,
        ])

        for (const [position, substance] of payload.substances.entries()) {
          await client.query(
            `INSERT INTO sds_substances
               (organization_id, sds_version_id, declared_name, cas_number, ec_number,
                concentration_min, concentration_max, concentration_exact,
                classification, source, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'corrected', $10)`,
            [
              context.organizationId,
              input.sdsVersionId,
              substance.declaredName,
              substance.casNumber || null,
              substance.ecNumber || null,
              substance.concentrationMin,
              substance.concentrationMax,
              substance.concentrationExact,
              JSON.stringify(
                substance.hazardStatements.map((code) => ({
                  hStatement: code,
                  declaredAs: substance.classificationText || null,
                })),
              ),
              position,
            ],
          )
        }

        return ok({
          sdsVersionId: input.sdsVersionId,
          attestationId: attestation.id,
          dataHash,
          archivedVersionId: precedente?.id ?? null,
          affectedProductIds: produitsConcernes,
        })
      },
    )
  } catch (erreur) {
    if (erreur instanceof AppError) return err(erreur)
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    if (message.includes('row-level security')) return err(AppError.forbidden())
    console.error('Échec de la validation d’une fiche', { message })
    return err(new AppError('INTERNAL', 'La validation n’a pas pu être enregistrée. Réessayez.'))
  }
}

/**
 * Signale les produits qui s'appuient sur une version archivée.
 *
 * Les alertes sont écrites par le rôle de service : un utilisateur ne peut pas
 * en forger. Aucune analyse n'est recalculée : l'alerte informe, elle n'agit pas.
 */
export async function notifyAffectedProducts(
  deps: SdsValidationDeps,
  context: RequestContext,
  input: { productIds: readonly string[]; commercialName: string },
): Promise<void> {
  if (input.productIds.length === 0) return

  await deps.serviceDb.transaction(async (client) => {
    for (const productId of input.productIds) {
      await client.query(
        `INSERT INTO notifications
           (organization_id, type, severity, title, body, product_id)
         VALUES ($1, 'product_uses_old_sds', 'action', $2, $3, $4)`,
        [
          context.organizationId,
          'Une nouvelle version de fiche est disponible',
          `Ce produit s’appuie sur une version archivée de « ${input.commercialName} ». Relancez l’analyse pour tenir compte de la nouvelle version.`,
          productId,
        ],
      )
    }

    await recordAudit(client, {
      organizationId: context.organizationId,
      actorUserId: context.userId,
      action: 'sds.version_archived',
      entityType: 'safety_data_sheet',
      after: { affectedProducts: input.productIds.length },
    })
  })
}

/** Trace la validation dans le journal d'audit. */
export async function recordValidationAudit(
  deps: SdsValidationDeps,
  context: RequestContext,
  outcome: ValidationOutcome,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  await deps.serviceDb
    .transaction((client) =>
      recordAudit(client, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'sds.validated',
        entityType: 'sds_version',
        entityId: outcome.sdsVersionId,
        after: {
          attestationId: outcome.attestationId,
          dataHash: outcome.dataHash,
          archivedVersionId: outcome.archivedVersionId,
        },
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    )
    .catch(() => undefined)
}
