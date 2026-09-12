import { describe, expect, it } from 'vitest'
import {
  assertNormative,
  explanatorySources,
  ExplanatorySourceMisuse,
  getSource,
  normativeSources,
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

  it('consigne le statut de chaque source dans sa note', () => {
    expect(REGULATORY_SOURCES.ECHA_FICHE_BOUGIES.notes).toContain('COMPRÉHENSION SEULEMENT')
  })
})

describe('hiérarchie des sources', () => {
  it('classe chaque source comme texte consolidé ou document de compréhension', () => {
    for (const source of Object.values(REGULATORY_SOURCES)) {
      expect(['normative', 'explanatory'], source.id).toContain(source.status)
    }
  })

  it('range la fiche d’information parmi les documents de compréhension', () => {
    expect(REGULATORY_SOURCES.ECHA_FICHE_BOUGIES.status).toBe('explanatory')
    expect(explanatorySources().map((s) => s.id)).toEqual(['ECHA_FICHE_BOUGIES'])
  })

  it('range les règlements et l’ordonnance parmi les textes consolidés', () => {
    expect(normativeSources().map((s) => s.id).sort()).toEqual([
      'CH_ORDONNANCE_2015_366',
      'EU_CLP_1272_2008',
      'EU_REACH_1907_2006',
    ])
  })

  it('refuse de tirer une valeur d’un document de compréhension', () => {
    // Garde-fou : même si la valeur cherchée y figure noir sur blanc.
    expect(() => assertNormative('ECHA_FICHE_BOUGIES')).toThrow(ExplanatorySourceMisuse)
    expect(() => assertNormative('ECHA_FICHE_BOUGIES')).toThrow(/pas un texte consolidé/)
  })

  it('laisse tirer une valeur d’un texte consolidé', () => {
    expect(assertNormative('EU_REACH_1907_2006').reference).toBe('CELEX 02006R1907')
    expect(assertNormative('EU_CLP_1272_2008').status).toBe('normative')
  })

  it('rend visible l’antériorité d’un document de compréhension', () => {
    const fiche = REGULATORY_SOURCES.ECHA_FICHE_BOUGIES
    expect(fiche.publishedOn).toBe('2024-08')

    // Le document est antérieur aux deux textes qu'il commente.
    expect(fiche.publishedOn! < '2026-06').toBe(true)
    expect(fiche.notes).toContain('antérieur')
    expect(fiche.notes).toContain('le texte consolidé prime')
  })

  it('n’exige une date de publication que des documents de compréhension', () => {
    for (const source of explanatorySources()) {
      expect(source.publishedOn, source.id).toBeDefined()
    }
  })
})
