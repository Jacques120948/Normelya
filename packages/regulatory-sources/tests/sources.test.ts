import { describe, expect, it } from 'vitest'
import {
  getSource,
  REGULATORY_SOURCES,
  staleSources,
  VERIFICATION_VALIDITY_MONTHS,
} from '../src/index'

describe('registre des sources', () => {
  const sources = Object.values(REGULATORY_SOURCES)

  it('déclare pour chaque source la version exactement consultée', () => {
    for (const source of sources) {
      expect(source.consultedVersion.length, source.id).toBeGreaterThan(0)
    }
  })

  it('exige une vérification humaine datée et nominative', () => {
    for (const source of sources) {
      expect(source.verifiedOn, source.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(source.verifiedBy.trim().length, source.id).toBeGreaterThan(0)
    }
  })

  it('associe chaque identifiant à sa propre entrée', () => {
    for (const [cle, source] of Object.entries(REGULATORY_SOURCES)) {
      expect(source.id).toBe(cle)
    }
  })

  it('rend une source par son identifiant', () => {
    expect(getSource('EU_REACH_1907_2006').reference).toBe('CELEX 02006R1907')
  })

  it('signale les vérifications trop anciennes', () => {
    // Aucune source n'est périmée le lendemain de sa vérification.
    expect(staleSources('2026-09-13')).toEqual([])
    // Toutes le sont au-delà du délai de validité.
    expect(staleSources('2028-01-01')).toHaveLength(Object.keys(REGULATORY_SOURCES).length)
  })

  it('fixe le délai de revérification à douze mois', () => {
    expect(VERIFICATION_VALIDITY_MONTHS).toBe(12)
  })

  it('refuse une date d’évaluation invalide plutôt que de renvoyer une liste vide', () => {
    expect(() => staleSources('pas-une-date')).toThrow(/invalide/)
  })

  it('distingue un document d’information d’un texte normatif', () => {
    // Une fiche d'information ne peut fonder aucune règle : la note doit le dire.
    expect(REGULATORY_SOURCES.ECHA_FICHE_BOUGIES.notes).toContain('pas un texte normatif')
  })
})
