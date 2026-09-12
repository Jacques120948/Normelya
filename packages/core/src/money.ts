/**
 * Les montants sont manipulés en centimes entiers. Aucun flottant ne circule
 * dans un calcul monétaire.
 */
export type Currency = 'EUR' | 'CHF'

export type Money = {
  amountCents: number
  currency: Currency
}

export function money(amountCents: number, currency: Currency = 'EUR'): Money {
  if (!Number.isInteger(amountCents)) {
    throw new Error(`Un montant doit être un nombre entier de centimes : ${amountCents}`)
  }
  return { amountCents, currency }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return { amountCents: a.amountCents + b.amountCents, currency: a.currency }
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return { amountCents: a.amountCents - b.amountCents, currency: a.currency }
}

/** Multiplication par une quantité, arrondi au centime le plus proche. */
export function multiplyMoney(value: Money, factor: number): Money {
  return { amountCents: Math.round(value.amountCents * factor), currency: value.currency }
}

/** Marge en pourcentage du prix de vente, arrondie à 0,01 %. */
export function marginPercent(cost: Money, sellingPrice: Money): number | null {
  assertSameCurrency(cost, sellingPrice)
  if (sellingPrice.amountCents === 0) return null
  const raw = ((sellingPrice.amountCents - cost.amountCents) / sellingPrice.amountCents) * 100
  return Math.round(raw * 100) / 100
}

export function formatMoney(value: Money, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amountCents / 100)
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Devises incompatibles : ${a.currency} et ${b.currency}`)
  }
}
