/**
 * Arithmétique des pourcentages.
 *
 * Les compositions sont exprimées en pourcentage massique avec six décimales.
 * Toutes les opérations passent par des entiers mis à l'échelle : l'addition de
 * 0,1 et 0,2 doit donner exactement 0,3, et un calcul rejoué dix ans plus tard
 * doit donner le même chiffre. Voir docs/04-moteur-reglementaire.md § 4.1.
 */

/** Nombre de décimales conservées (aligné sur numeric(9,6) en base). */
export const PERCENT_DECIMALS = 6
const SCALE = 10 ** PERCENT_DECIMALS

export class PercentError extends Error {}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new PercentError(`${label} doit être un nombre fini, reçu : ${String(value)}`)
  }
}

/** Arrondi décimal déterministe (demi vers le haut en valeur absolue). */
export function roundPercent(value: number, decimals: number = PERCENT_DECIMALS): number {
  assertFinite(value, 'Un pourcentage')
  const factor = 10 ** decimals
  const scaled = value * factor
  // Corrige la représentation binaire avant l'arrondi (ex. 2.675 * 100 = 267.49999…).
  const corrected = Number(scaled.toPrecision(15))
  const rounded = corrected < 0 ? -Math.round(-corrected) : Math.round(corrected)
  return rounded / factor
}

function toScaled(value: number): number {
  assertFinite(value, 'Un pourcentage')
  return Math.round(Number((value * SCALE).toPrecision(15)))
}

function fromScaled(scaled: number): number {
  return scaled / SCALE
}

/** Somme exacte d'une liste de pourcentages. */
export function sumPercents(values: readonly number[]): number {
  let total = 0
  for (const value of values) total += toScaled(value)
  return fromScaled(total)
}

/**
 * Concentration d'une substance dans le produit fini.
 *
 * @param materialPercent  part de la matière première dans la recette (%)
 * @param substancePercent part de la substance dans la matière première (%)
 */
export function concentrationInProduct(
  materialPercent: number,
  substancePercent: number,
): number {
  assertPercentRange(materialPercent, 'Le pourcentage de matière première')
  assertPercentRange(substancePercent, 'Le pourcentage de substance')
  return roundPercent((materialPercent * substancePercent) / 100)
}

export function assertPercentRange(value: number, label = 'Un pourcentage'): void {
  assertFinite(value, label)
  if (value < 0 || value > 100) {
    throw new PercentError(`${label} doit être compris entre 0 et 100, reçu : ${value}`)
  }
}

export type RecipeTotalCheck =
  | { valid: true; total: number }
  | { valid: false; total: number; difference: number; message: string }

/**
 * Contrôle du total d'une recette. Le total doit valoir exactement 100 %.
 * Aucune tolérance implicite : une recette à 99,9 % est refusée et l'écart est
 * affiché à l'utilisateur.
 */
export function checkRecipeTotal(percents: readonly number[]): RecipeTotalCheck {
  const total = sumPercents(percents)
  if (total === 100) return { valid: true, total }
  const difference = roundPercent(100 - total)
  const message =
    difference > 0
      ? `Il manque ${formatPercent(difference)} pour atteindre 100 %.`
      : `Le total dépasse 100 % de ${formatPercent(Math.abs(difference))}.`
  return { valid: false, total, difference, message }
}

/**
 * Nombre décimal en écriture française, sans unité.
 *
 * Les zéros décimaux inutiles sont retirés. Sert notamment à pré-remplir un
 * champ de saisie, où un signe « % » serait renvoyé tel quel au serveur.
 */
export function formatDecimal(value: number, maxDecimals = PERCENT_DECIMALS): string {
  const rounded = roundPercent(value, maxDecimals)
  const text = rounded
    .toFixed(maxDecimals)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
  return text.replace('.', ',')
}

/** Affichage lisible d'un pourcentage, signe compris. */
export function formatPercent(value: number, maxDecimals = PERCENT_DECIMALS): string {
  return `${formatDecimal(value, maxDecimals)} %`
}

export type ConcentrationRange = {
  min: number
  max: number
  /** true si la FDS déclare une valeur exacte plutôt qu'une plage. */
  exact: boolean
}

/**
 * Normalise une déclaration de concentration issue d'une FDS.
 * Une valeur exacte devient une plage dégénérée ; une plage reste une plage —
 * le moteur ne choisit jamais une valeur « raisonnable » au milieu.
 */
export function normalizeConcentration(input: {
  min?: number | null
  max?: number | null
  exact?: number | null
}): ConcentrationRange | null {
  if (input.exact !== undefined && input.exact !== null) {
    assertPercentRange(input.exact, 'Une concentration')
    return { min: input.exact, max: input.exact, exact: true }
  }
  const hasMin = input.min !== undefined && input.min !== null
  const hasMax = input.max !== undefined && input.max !== null
  if (!hasMin && !hasMax) return null
  const min = hasMin ? (input.min as number) : 0
  const max = hasMax ? (input.max as number) : 100
  assertPercentRange(min, 'Une concentration minimale')
  assertPercentRange(max, 'Une concentration maximale')
  if (min > max) {
    throw new PercentError(
      `Concentration incohérente : le minimum (${min}) dépasse le maximum (${max}).`,
    )
  }
  return { min, max, exact: min === max }
}
