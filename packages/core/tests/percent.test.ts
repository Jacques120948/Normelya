import { describe, expect, it } from 'vitest'
import {
  checkRecipeTotal,
  concentrationInProduct,
  formatDecimal,
  formatPercent,
  normalizeConcentration,
  PercentError,
  roundPercent,
  sumPercents,
} from '../src/percent'

describe('arithmétique des pourcentages', () => {
  it('additionne sans erreur de représentation binaire', () => {
    // 0.1 + 0.2 vaut 0.30000000000000004 en flottant : inacceptable pour une recette.
    expect(sumPercents([0.1, 0.2])).toBe(0.3)
    expect(sumPercents([91, 9])).toBe(100)
    expect(sumPercents([33.333333, 33.333333, 33.333334])).toBe(100)
  })

  it('arrondit de façon déterministe', () => {
    expect(roundPercent(2.675, 2)).toBe(2.68)
    expect(roundPercent(-2.675, 2)).toBe(-2.68)
    expect(roundPercent(1.0000004)).toBe(1)
    expect(roundPercent(1.0000005)).toBe(1.000001)
  })

  it('refuse une valeur non finie', () => {
    expect(() => roundPercent(Number.NaN)).toThrow(PercentError)
    expect(() => roundPercent(Number.POSITIVE_INFINITY)).toThrow(PercentError)
  })

  describe('concentration dans le produit fini', () => {
    it('applique le produit des deux pourcentages', () => {
      // 9 % de parfum dans la recette, 10 % de la substance dans le parfum
      // => 0,9 % de la substance dans la bougie.
      expect(concentrationInProduct(9, 10)).toBe(0.9)
      expect(concentrationInProduct(100, 100)).toBe(100)
      expect(concentrationInProduct(0.5, 0.5)).toBe(0.0025)
    })

    it('refuse un pourcentage hors bornes', () => {
      expect(() => concentrationInProduct(101, 10)).toThrow(PercentError)
      expect(() => concentrationInProduct(9, -1)).toThrow(PercentError)
    })
  })

  describe('total de recette', () => {
    it('accepte exactement 100 %', () => {
      expect(checkRecipeTotal([91, 9])).toEqual({ valid: true, total: 100 })
    })

    it("refuse 99,9 % sans tolérance implicite et affiche l'écart", () => {
      const result = checkRecipeTotal([91, 8.9])
      expect(result.valid).toBe(false)
      if (result.valid) throw new Error('inattendu')
      expect(result.total).toBe(99.9)
      expect(result.difference).toBe(0.1)
      expect(result.message).toContain('Il manque')
    })

    it('refuse un dépassement de 100 %', () => {
      const result = checkRecipeTotal([91, 10])
      expect(result.valid).toBe(false)
      if (result.valid) throw new Error('inattendu')
      expect(result.message).toContain('dépasse')
    })
  })

  describe('normalisation des concentrations déclarées en FDS', () => {
    it('conserve une plage telle quelle, sans choisir de valeur médiane', () => {
      expect(normalizeConcentration({ min: 5, max: 10 })).toEqual({
        min: 5,
        max: 10,
        exact: false,
      })
    })

    it('transforme une valeur exacte en plage dégénérée', () => {
      expect(normalizeConcentration({ exact: 7.5 })).toEqual({ min: 7.5, max: 7.5, exact: true })
    })

    it('complète une borne manquante par la borne physique correspondante', () => {
      expect(normalizeConcentration({ max: 1 })).toEqual({ min: 0, max: 1, exact: false })
      expect(normalizeConcentration({ min: 25 })).toEqual({ min: 25, max: 100, exact: false })
    })

    it('renvoie null quand rien n’est déclaré', () => {
      expect(normalizeConcentration({})).toBeNull()
      expect(normalizeConcentration({ min: null, max: null, exact: null })).toBeNull()
    })

    it('refuse une plage incohérente', () => {
      expect(() => normalizeConcentration({ min: 10, max: 5 })).toThrow(PercentError)
    })
  })

  it('formate en français', () => {
    expect(formatPercent(9)).toBe('9 %')
    expect(formatPercent(0.9)).toBe('0,9 %')
    expect(formatPercent(12.5)).toBe('12,5 %')
  })

  it('formate un nombre sans unité, pour un champ de saisie', () => {
    // Un signe « % » pré-rempli dans un champ repartirait tel quel au serveur.
    expect(formatDecimal(9)).toBe('9')
    expect(formatDecimal(88.5)).toBe('88,5')
    expect(formatDecimal(0.1)).toBe('0,1')
    expect(formatDecimal(7.2, 3)).toBe('7,2')
  })
})
