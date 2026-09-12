'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { MAX_UPLOAD_BYTES } from '@normelya/core'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { importSdsDocument } from '@/server/application/sds-import'
import {
  notifyAffectedProducts,
  recordValidationAudit,
  validateSdsVersion,
} from '@/server/application/sds-validation'

export type EtatImport = {
  erreur?: string
}

export type EtatValidation = {
  erreur?: string
  champs?: Record<string, string>
}

async function meta() {
  const entetes = await headers()
  return {
    ip: entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: entetes.get('user-agent'),
  }
}

/**
 * Dépôt d'une fiche fournisseur.
 *
 * Le fichier est lu en mémoire pour calculer son empreinte et vérifier ses
 * octets d'en-tête avant tout stockage. La taille est contrôlée deux fois :
 * ici, pour refuser tôt, et dans le service, qui ne fait confiance à personne.
 */
export async function importerFdsAction(
  matiereId: string,
  _etat: EtatImport,
  donnees: FormData,
): Promise<EtatImport> {
  const { context } = await exigerAtelier()
  const { db, serviceDb, storage } = services()

  const fichier = donnees.get('document')
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez un fichier PDF.' }
  }
  if (fichier.size > MAX_UPLOAD_BYTES) {
    return { erreur: 'Le fichier dépasse la taille maximale de 20 Mo.' }
  }

  const octets = new Uint8Array(await fichier.arrayBuffer())

  const resultat = await importSdsDocument(
    { db, serviceDb, storage },
    context,
    { rawMaterialId: matiereId, filename: fichier.name, bytes: octets },
    await meta(),
  )

  if (!resultat.ok) return { erreur: resultat.error.userMessage }

  revalidatePath(`/matieres-premieres/${matiereId}`)
  redirect(`/matieres-premieres/${matiereId}/fds/${resultat.value.sdsVersionId}`)
}

/**
 * Validation d'une fiche vérifiée.
 *
 * La confirmation est revalidée côté serveur : une case cochée dans le
 * navigateur n'engage rien tant que le serveur ne l'a pas reçue et enregistrée.
 */
export async function validerFdsAction(
  matiereId: string,
  versionId: string,
  _etat: EtatValidation,
  donnees: FormData,
): Promise<EtatValidation> {
  const { user, context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const brut = donnees.get('payload')
  if (typeof brut !== 'string') {
    return { erreur: 'Les informations vérifiées n’ont pas été transmises. Réessayez.' }
  }

  let payload: unknown
  try {
    payload = JSON.parse(brut)
  } catch {
    return { erreur: 'Les informations vérifiées sont illisibles. Réessayez.' }
  }

  const informations = await meta()
  const resultat = await validateSdsVersion(
    { db, serviceDb },
    context,
    {
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
      email: user.email,
    },
    { sdsVersionId: versionId, payload, confirmed: donnees.get('confirmed') === 'on' },
    informations,
  )

  if (!resultat.ok) {
    const issues = (resultat.error.details as { issues?: { path: (string | number)[]; message: string }[] })
      ?.issues
    const champs: Record<string, string> = {}
    for (const issue of issues ?? []) {
      champs[issue.path.join('.')] ??= issue.message
    }
    return { erreur: issues ? undefined : resultat.error.userMessage, champs }
  }

  await recordValidationAudit({ db, serviceDb }, context, resultat.value, informations)

  if (resultat.value.affectedProductIds.length > 0) {
    await notifyAffectedProducts({ db, serviceDb }, context, {
      productIds: resultat.value.affectedProductIds,
      commercialName: String(donnees.get('commercialName') ?? 'cette matière'),
    })
  }

  revalidatePath(`/matieres-premieres/${matiereId}`)
  redirect(`/matieres-premieres/${matiereId}?fds=validee`)
}
