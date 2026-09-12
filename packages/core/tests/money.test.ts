import { describe, expect, it } from 'vitest'
import { addMoney, formatMoney, marginPercent, money, multiplyMoney, subtractMoney } from '../src/money'

/** Intl insère des espaces insécables et un symbole selon la version d'ICU. */
function normaliserEspaces(valeur: string): string {
  return valeur.replace(/\s/g, ' ').replace('€', 'EUR')
}

describe('arithmétique monétaire', () => {
  it('refuse un montant non entier en centimes', () => {
    expect(() => money(10.5)).toThrow()
  })

  it('additionne et soustrait dans la même devise', () => {
    expect(addMoney(money(1990), money(990))).toEqual({ amountCents: 2980, currency: 'EUR' })
    expect(subtractMoney(money(1990), money(990))).toEqual({ amountCents: 1000, currency: 'EUR' })
  })

  it('refuse de mélanger les devises', () => {
    expect(() => addMoney(money(100, 'EUR'), money(100, 'CHF'))).toThrow(/Devises incompatibles/)
  })

  it('arrondit au centime lors d’une multiplication', () => {
    expect(multiplyMoney(money(333), 3)).toEqual({ amountCents: 999, currency: 'EUR' })
    expect(multiplyMoney(money(100), 0.335)).toEqual({ amountCents: 34, currency: 'EUR' })
  })

  it('calcule la marge en pourcentage du prix de vente', () => {
    // Coût 6 €, vente 20 € => marge 70 %.
    expect(marginPercent(money(600), money(2000))).toBe(70)
    expect(marginPercent(money(600), money(0))).toBeNull()
  })

  it('formate en euros et en francs', () => {
    expect(normaliserEspaces(formatMoney(money(1990)))).toBe('19,90 EUR')
    expect(normaliserEspaces(formatMoney(money(1990, 'CHF')))).toContain('CHF')
  })
})
