import {
  AppError,
  err,
  ok,
  MAX_UPLOAD_BYTES,
  type RequestContext,
  type Result,
} from '@normelya/core'
import { extractFromText, type ExtractionOutcome } from '@normelya/sds-extraction'
import { extractTextFromPdf, looksLikePdf } from '@normelya/sds-extraction/pdf'
import type { Database } from '../ports/database'
import type { FileStorage } from '../ports/storage'
import { recordAudit } from '../security/audit'
import { requireRole } from '../security/request-context'
import { sha256Hex } from '../security/hashing'
import { assertWithinQuota } from './quotas'

/**
 * Import d'une fiche de données de sécurité fournisseur.
 *
 * Trois principes.
 *
 * 1. Rien n'est réputé exact. La lecture produit une proposition, jamais une
 *    donnée validée. La version reste en attente de vérification tant qu'une
 *    personne ne l'a pas confirmée.
 *
 * 2. La lecture est déterministe. Aucun modèle de langage n'est sollicité ici :
 *    sur le corpus mesuré, l'analyse du texte suffit. Le repli en cas d'échec
 *    est la saisie manuelle, disponible sans limite.
 *
 * 3. Le document original est conservé intact, avec son empreinte. C'est lui qui
 *    fait foi, pas ce qui en a été lu.
 */

export type SdsImportDeps = {
  db: Database
  serviceDb: Database
  storage: FileStorage
}

export type ImportedSdsVersion = {
  sdsVersionId: string
  documentId: string
  /** Vrai si ce document avait déjà été déposé : il n'est ni restocké ni relu. */
  alreadyImported: boolean
  extraction: ExtractionOutcome | null
  /** Méthode ayant abouti, journalisée avec la tentative. */
  method: 'pdf_text' | 'ocr' | 'manual'
}

export async function importSdsDocument(
  deps: SdsImportDeps,
  context: RequestContext,
  input: {
    rawMaterialId: string
    filename: string
    bytes: Uint8Array
  },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<ImportedSdsVersion, AppError>> {
  requireRole(context, 'member')

  // Contrôle du format par les octets d'en-tête : l'extension et le type
  // déclaré par le navigateur sont tous deux falsifiables.
  if (!looksLikePdf(input.bytes)) {
    return err(
      new AppError('UNSUPPORTED_FILE', 'Ce fichier n’est pas un PDF. Seuls les PDF sont acceptés.'),
    )
  }

  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    return err(
      new AppError('FILE_TOO_LARGE', 'Le fichier dépasse la taille maximale de 20 Mo.'),
    )
  }

  const empreinte = sha256Hex(input.bytes)

  try {
    return await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        const matiere = await client.queryOne<{ id: string; name: string; supplier_id: string | null }>(
          `SELECT id, name, supplier_id FROM raw_materials
           WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`,
          [context.organizationId, input.rawMaterialId],
        )
        if (!matiere) return err(AppError.notFound("Cette matière première n'existe pas."))

        // Déduplication : le même fichier n'est ni restocké ni relu.
        const existant = await client.queryOne<{ id: string }>(
          `SELECT id FROM documents
           WHERE organization_id = $1 AND sha256 = $2 AND deleted_at IS NULL`,
          [context.organizationId, empreinte],
        )
        if (existant) {
          const versionExistante = await client.queryOne<{ id: string }>(
            `SELECT id FROM sds_versions WHERE document_id = $1`,
            [existant.id],
          )
          if (versionExistante) {
            return ok({
              sdsVersionId: versionExistante.id,
              documentId: existant.id,
              alreadyImported: true,
              extraction: null,
              method: 'pdf_text' as const,
            })
          }
        }

        await assertWithinQuota(client, {
          organizationId: context.organizationId,
          plan: context.plan,
          metric: 'storage_bytes',
        })

        // Lecture du document. Elle précède l'écriture : un document illisible
        // est tout de même conservé, mais on sait dès maintenant quoi proposer.
        const lecture = await extractTextFromPdf(input.bytes)
        const extraction = lecture.hasTextLayer ? extractFromText(lecture.text) : null
        const method: ImportedSdsVersion['method'] = lecture.hasTextLayer ? 'pdf_text' : 'manual'

        const cle = `${context.organizationId}/fds/${empreinte}.pdf`
        const depot = await deps.storage.put({
          key: cle,
          body: input.bytes,
          contentType: 'application/pdf',
        })
        if (!depot.ok) {
          return err(
            new AppError('PROVIDER_ERROR', 'Le document n’a pas pu être enregistré. Réessayez.'),
          )
        }

        const document = await client.queryOne<{ id: string }>(
          `INSERT INTO documents
             (organization_id, kind, storage_key, original_filename, mime_type,
              byte_size, sha256, raw_material_id, uploaded_by)
           VALUES ($1, 'sds', $2, $3, 'application/pdf', $4, $5, $6, $7)
           RETURNING id`,
          [
            context.organizationId,
            cle,
            input.filename,
            input.bytes.byteLength,
            empreinte,
            input.rawMaterialId,
            context.userId,
          ],
        )
        if (!document) return err(new AppError('INTERNAL', 'Le document n’a pas pu être créé.'))

        // Une matière possède une fiche stable, et cette fiche des versions.
        let fiche = await client.queryOne<{ id: string }>(
          `SELECT id FROM safety_data_sheets
           WHERE organization_id = $1 AND raw_material_id = $2 AND deleted_at IS NULL`,
          [context.organizationId, input.rawMaterialId],
        )
        if (!fiche) {
          fiche = await client.queryOne<{ id: string }>(
            `INSERT INTO safety_data_sheets
               (organization_id, raw_material_id, supplier_id, commercial_name)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
              context.organizationId,
              input.rawMaterialId,
              matiere.supplier_id,
              extraction?.productName.value ?? matiere.name,
            ],
          )
        }
        if (!fiche) return err(new AppError('INTERNAL', 'La fiche n’a pas pu être créée.'))

        const etiquetteVersion = await libellerVersion(
          client,
          fiche.id,
          extraction?.versionLabel.value ?? null,
        )

        const version = await client.queryOne<{ id: string }>(
          `INSERT INTO sds_versions
             (organization_id, safety_data_sheet_id, document_id, version_label,
              revision_date, language, status, extracted_payload, extraction_method,
              extraction_confidence, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'needs_review', $7, $8, $9, $10)
           RETURNING id`,
          [
            context.organizationId,
            fiche.id,
            document.id,
            etiquetteVersion,
            extraction?.revisionDate.value || null,
            extraction?.languageHint || null,
            extraction ? JSON.stringify(extraction) : null,
            method,
            extraction ? arrondir(extraction.completeness) : null,
            context.userId,
          ],
        )
        if (!version) return err(new AppError('INTERNAL', 'La version n’a pas pu être créée.'))

        // Tentative de lecture journalisée : on doit pouvoir prouver, document
        // par document, quelle méthode a abouti.
        await client.query(
          `INSERT INTO sds_extraction_runs
             (organization_id, sds_version_id, method, succeeded, raw_output)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            context.organizationId,
            version.id,
            method,
            extraction !== null,
            extraction ? JSON.stringify({ completeness: extraction.completeness, issues: extraction.issues }) : null,
          ],
        )

        return ok({
          sdsVersionId: version.id,
          documentId: document.id,
          alreadyImported: false,
          extraction,
          method,
        })
      },
    )
  } catch (erreur) {
    if (erreur instanceof AppError) return err(erreur)
    console.error("Échec de l'import d'une fiche", {
      message: erreur instanceof Error ? erreur.message : String(erreur),
    })
    return err(new AppError('INTERNAL', 'Le document n’a pas pu être importé. Réessayez.'))
  } finally {
    await deps.serviceDb
      .transaction((client) =>
        recordAudit(client, {
          organizationId: context.organizationId,
          actorUserId: context.userId,
          action: 'sds.imported',
          entityType: 'raw_material',
          entityId: input.rawMaterialId,
          after: { filename: input.filename, sha256: empreinte },
          ip: meta.ip,
          userAgent: meta.userAgent,
        }),
      )
      .catch(() => undefined)
  }
}

/**
 * Libellé de version.
 *
 * Celui lu dans le document est repris s'il est exploitable et pas déjà pris.
 * Sinon, un rang est attribué. Aucune version n'écrase la précédente.
 */
async function libellerVersion(
  client: { queryOne: Database['queryOne'] },
  ficheId: string,
  lu: string | null,
): Promise<string> {
  if (lu && lu.trim().length > 0) {
    const pris = await client.queryOne<{ id: string }>(
      `SELECT id FROM sds_versions WHERE safety_data_sheet_id = $1 AND version_label = $2`,
      [ficheId, lu.trim()],
    )
    if (!pris) return lu.trim()
  }

  const rang = await client.queryOne<{ total: string }>(
    `SELECT count(*)::text AS total FROM sds_versions WHERE safety_data_sheet_id = $1`,
    [ficheId],
  )
  return `V${Number(rang?.total ?? 0) + 1}`
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 1000) / 1000
}
