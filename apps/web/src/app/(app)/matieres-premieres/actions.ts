'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { RAW_MATERIAL_CATEGORIES, type RawMaterialCategory } from '@normelya/core'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import {
  archiveRawMaterial,
  createRawMaterial,
  updateRawMaterial,
} from '@/server/application/raw-materials'

export type EtatMatiere = {
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
 * Lecture du formulaire.
 *
 * Le prix est saisi en euros et converti en centimes entiers : aucun flottant
 * ne descend jusqu'à la base.
 */
function lireFormulaire(donnees: FormData) {
  const prixTexte = String(donnees.get('purchasePrice') ?? '').replace(',', '.').trim()
  const quantiteTexte = String(donnees.get('purchaseQuantity') ?? '').replace(',', '.').trim()
  const categorie = String(donnees.get('category') ?? '')

  return {
    name: String(donnees.get('name') ?? '').trim(),
    category: (RAW_MATERIAL_CATEGORIES as readonly string[]).includes(categorie)
      ? (categorie as RawMaterialCategory)
      : ('other' as RawMaterialCategory),
    supplierName: String(donnees.get('supplierName') ?? '').trim(),
    internalReference: String(donnees.get('internalReference') ?? '').trim(),
    purchasePriceCents:
      prixTexte.length > 0 && Number.isFinite(Number(prixTexte))
        ? Math.round(Number(prixTexte) * 100)
        : null,
    purchaseQuantity:
      quantiteTexte.length > 0 && Number.isFinite(Number(quantiteTexte))
        ? Number(quantiteTexte)
        : null,
    purchaseUnit: (String(donnees.get('purchaseUnit') ?? '') || null) as
      | 'g'
      | 'kg'
      | 'ml'
      | 'l'
      | 'unit'
      | null,
    notes: String(donnees.get('notes') ?? '').trim(),
  }
}

function champsEnErreur(details: unknown): Record<string, string> {
  const champs: Record<string, string> = {}
  const issues = (details as { issues?: { path: (string | number)[]; message: string }[] })?.issues
  for (const issue of issues ?? []) {
    const cle = String(issue.path[0] ?? 'global')
    champs[cle] ??= issue.message
  }
  return champs
}

export async function creerMatiereAction(
  _etat: EtatMatiere,
  donnees: FormData,
): Promise<EtatMatiere> {
  const { context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const resultat = await createRawMaterial(
    { db, serviceDb },
    context,
    lireFormulaire(donnees),
    await meta(),
  )

  if (!resultat.ok) {
    return {
      erreur: resultat.error.code === 'VALIDATION_FAILED' ? undefined : resultat.error.userMessage,
      champs: champsEnErreur(resultat.error.details),
    }
  }

  revalidatePath('/matieres-premieres')
  redirect(`/matieres-premieres/${resultat.value.id}`)
}

export async function modifierMatiereAction(
  id: string,
  _etat: EtatMatiere,
  donnees: FormData,
): Promise<EtatMatiere> {
  const { context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const resultat = await updateRawMaterial(
    { db, serviceDb },
    context,
    id,
    lireFormulaire(donnees),
    await meta(),
  )

  if (!resultat.ok) {
    return {
      erreur: resultat.error.code === 'VALIDATION_FAILED' ? undefined : resultat.error.userMessage,
      champs: champsEnErreur(resultat.error.details),
    }
  }

  revalidatePath('/matieres-premieres')
  revalidatePath(`/matieres-premieres/${id}`)
  return {}
}

export async function archiverMatiereAction(donnees: FormData): Promise<void> {
  const { context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const id = String(donnees.get('id') ?? '')
  const archiver = donnees.get('archiver') === '1'

  await archiveRawMaterial({ db, serviceDb }, context, id, archiver, await meta())

  revalidatePath('/matieres-premieres')
  revalidatePath(`/matieres-premieres/${id}`)
  redirect('/matieres-premieres')
}
