'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  INGREDIENT_ROLES,
  MARKETS,
  PRODUCT_TYPES,
  type IngredientRole,
  type Market,
  type ProductType,
} from '@normelya/core'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { archiveProduct, createProduct, saveRecipe } from '@/server/application/products'

export type EtatProduit = {
  erreur?: string
  champs?: Record<string, string>
}

export type EtatRecette = {
  erreur?: string
  succes?: string
  /** Renseigné quand l'enregistrement a dû créer une nouvelle version. */
  nouvelleVersion?: boolean
}

async function meta() {
  const entetes = await headers()
  return {
    ip: entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: entetes.get('user-agent'),
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

/**
 * Lecture d'un nombre saisi par un humain.
 *
 * La virgule décimale est acceptée : c'est la façon française d'écrire 7,5 %.
 * Une saisie vide ou illisible renvoie null — jamais une valeur de repli.
 */
function lireNombre(valeur: FormDataEntryValue | null): number | null {
  const texte = String(valeur ?? '').replace(',', '.').trim()
  if (texte.length === 0) return null
  const nombre = Number(texte)
  return Number.isFinite(nombre) ? nombre : null
}

export async function creerProduitAction(
  _etat: EtatProduit,
  donnees: FormData,
): Promise<EtatProduit> {
  const { context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const type = String(donnees.get('productType') ?? '')
  const marches = donnees
    .getAll('markets')
    .map(String)
    .filter((valeur): valeur is Market => (MARKETS as readonly string[]).includes(valeur))
  const poids = lireNombre(donnees.get('netWeightGrams'))

  const resultat = await createProduct(
    { db, serviceDb },
    context,
    {
      name: String(donnees.get('name') ?? '').trim(),
      productType: ((PRODUCT_TYPES as readonly string[]).includes(type)
        ? type
        : 'candle') as ProductType,
      markets: marches,
      netWeightGrams: poids ?? undefined,
      containerDescription: String(donnees.get('containerDescription') ?? '').trim(),
    },
    await meta(),
  )

  if (!resultat.ok) {
    return {
      erreur: resultat.error.code === 'VALIDATION_FAILED' ? undefined : resultat.error.userMessage,
      champs:
        resultat.error.code === 'VALIDATION_FAILED'
          ? champsEnErreur(resultat.error.details)
          : undefined,
    }
  }

  revalidatePath('/produits')
  redirect(`/produits/${resultat.value.productId}`)
}

/**
 * Enregistrement d'une recette.
 *
 * Le formulaire envoie des lignes numérotées. Une ligne sans matière est
 * ignorée : c'est une ligne vide laissée par l'utilisateur, pas une erreur.
 */
export async function enregistrerRecetteAction(
  productId: string,
  _etat: EtatRecette,
  donnees: FormData,
): Promise<EtatRecette> {
  const { context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const lignes: {
    rawMaterialId: string
    sdsVersionId: string | null
    percent: number
    role: IngredientRole
  }[] = []

  for (const [cle, valeur] of donnees.entries()) {
    const correspondance = /^ingredients\[(\d+)\]\[rawMaterialId\]$/.exec(cle)
    if (!correspondance) continue
    const index = correspondance[1]
    const matiere = String(valeur).trim()
    if (matiere.length === 0) continue

    const role = String(donnees.get(`ingredients[${index}][role]`) ?? '')
    const fiche = String(donnees.get(`ingredients[${index}][sdsVersionId]`) ?? '').trim()

    lignes.push({
      rawMaterialId: matiere,
      sdsVersionId: fiche.length > 0 ? fiche : null,
      // Le pourcentage est un champ numérique libre : aucune valeur n'est
      // proposée, aucune n'est corrigée. Une saisie illisible reste illisible
      // et sera refusée par la validation.
      percent: lireNombre(donnees.get(`ingredients[${index}][percent]`)) ?? Number.NaN,
      role: ((INGREDIENT_ROLES as readonly string[]).includes(role)
        ? role
        : 'other') as IngredientRole,
    })
  }

  const resultat = await saveRecipe(
    { db, serviceDb },
    context,
    { productId, ingredients: lignes },
    await meta(),
  )

  if (!resultat.ok) return { erreur: resultat.error.userMessage }

  revalidatePath('/produits')
  revalidatePath(`/produits/${productId}`)
  return {
    succes: 'Recette enregistrée.',
    nouvelleVersion: resultat.value.createdNewVersion,
  }
}

export async function archiverProduitAction(donnees: FormData): Promise<void> {
  const { context } = await exigerAtelier()
  const { db, serviceDb } = services()

  const productId = String(donnees.get('id') ?? '')
  const archiver = donnees.get('archiver') === '1'

  const resultat = await archiveProduct(
    { db, serviceDb },
    context,
    { productId, archive: archiver },
    await meta(),
  )

  revalidatePath('/produits')
  revalidatePath(`/produits/${productId}`)

  // Un refus de quota à la réactivation doit rester visible : l'utilisateur
  // revient sur la fiche du produit, qui affiche son état réel.
  if (!resultat.ok) redirect(`/produits/${productId}?erreur=quota`)
  redirect(archiver ? '/produits' : `/produits/${productId}`)
}
