import { describe, expect, it } from 'vitest'
import { buildCorpusReport, formatCorpusReport, measureSheet } from '../src/report/coverage'
import { extractFromText } from '../src/text/pipeline'

const FICHE_COMPLETE = `
RUBRIQUE 1 : Identification
Nom commercial : DEMO Parfum A
Fournisseur : DEMO Maison des Parfums
RUBRIQUE 2 : Dangers
H317
RUBRIQUE 3 : Composition
DEMO Substance A 78-70-6 5 - 10 % H317
RUBRIQUE 9 : Propriétés
Point d'éclair : 93 °C
RUBRIQUE 16 : Autres informations
Version : 2.0
Date de révision : 12/03/2026
`

const FICHE_PARTIELLE = `
RUBRIQUE 1 : Identification
Nom commercial : DEMO Parfum B
Fournisseur : DEMO Cirerie du Sud
RUBRIQUE 3 : Composition
DEMO Substance B 7647-14-5 1 %
`

const FICHE_ILLISIBLE = 'Document scanné sans couche de texte exploitable.'

function mesurer(reference: string, texte: string, methode: 'pdf_text' | 'ocr' | 'manual') {
  return measureSheet({ documentRef: reference, outcome: extractFromText(texte), method: methode })
}

describe('mesure d’une fiche', () => {
  it('classe en lecture automatique une fiche entièrement lue', () => {
    const mesure = mesurer('demo-a.pdf', FICHE_COMPLETE, 'pdf_text')
    expect(mesure.verdict).toBe('automatic')
    expect(mesure.fieldsMissing).toEqual([])
    expect(mesure.supplier).toBe('DEMO Maison des Parfums')
    expect(mesure.compositionRowCount).toBe(1)
  })

  it('classe en vérification légère une fiche à laquelle il manque des champs', () => {
    const mesure = mesurer('demo-b.pdf', FICHE_PARTIELLE, 'pdf_text')
    expect(mesure.verdict).toBe('light_review')
    expect(mesure.fieldsMissing).toContain('revisionDate')
  })

  it('classe en saisie manuelle une fiche sans composition, même bien renseignée par ailleurs', () => {
    const mesure = mesurer(
      'demo-c.pdf',
      `RUBRIQUE 1 : Identification\nNom commercial : DEMO C\nFournisseur : DEMO F\nRUBRIQUE 16 : Autres\nVersion : 1.0\nDate de révision : 01/01/2026`,
      'pdf_text',
    )
    expect(mesure.verdict).toBe('manual_entry')
  })

  it('classe en saisie manuelle une fiche illisible', () => {
    const mesure = mesurer('demo-d.pdf', FICHE_ILLISIBLE, 'ocr')
    expect(mesure.verdict).toBe('manual_entry')
    expect(mesure.supplier).toBe('inconnu')
  })

  it('ne conserve que la référence du document, jamais son contenu', () => {
    // La mesure sert au pilotage : elle ne doit pas recopier la fiche.
    const serialisee = JSON.stringify(mesurer('demo-a.pdf', FICHE_COMPLETE, 'pdf_text'))
    for (const contenu of ['78-70-6', 'DEMO Substance A', 'H317', '93', '5 - 10 %']) {
      expect(serialisee, contenu).not.toContain(contenu)
    }
    // Seuls la référence du document et le fournisseur sont conservés.
    expect(serialisee).toContain('demo-a.pdf')
  })
})

describe('rapport de corpus', () => {
  const mesures = [
    mesurer('demo-a.pdf', FICHE_COMPLETE, 'pdf_text'),
    mesurer('demo-b.pdf', FICHE_PARTIELLE, 'pdf_text'),
    mesurer('demo-d.pdf', FICHE_ILLISIBLE, 'ocr'),
  ]

  it('agrège les verdicts', () => {
    const rapport = buildCorpusReport(mesures)
    expect(rapport.sheets).toBe(3)
    expect(rapport.byVerdict).toEqual({ automatic: 1, light_review: 1, manual_entry: 1 })
    expect(rapport.overallSuccessRate).toBeCloseTo(2 / 3, 5)
  })

  it('calcule le taux de lecture par champ', () => {
    const rapport = buildCorpusReport(mesures)
    expect(rapport.byField.composition).toEqual({ found: 2, rate: 2 / 3 })
    expect(rapport.byField.revisionDate.found).toBe(1)
  })

  it('détaille par fournisseur', () => {
    const rapport = buildCorpusReport(mesures)
    const parfums = rapport.bySupplier.find((s) => s.supplier === 'DEMO Maison des Parfums')
    expect(parfums).toMatchObject({ sheets: 1, automatic: 1, successRate: 1 })
    const inconnu = rapport.bySupplier.find((s) => s.supplier === 'inconnu')
    expect(inconnu).toMatchObject({ sheets: 1, manualEntry: 1, successRate: 0 })
  })

  it('mesure le recours au modèle de langage', () => {
    const rapport = buildCorpusReport(mesures)
    expect(rapport.aiFallbackRate).toBe(0)
    expect(rapport.byMethod.pdf_text).toBe(2)
    expect(rapport.byMethod.ocr).toBe(1)
  })

  it('n’invente aucune statistique sur un corpus vide', () => {
    const rapport = buildCorpusReport([])
    expect(rapport.sheets).toBe(0)
    expect(rapport.overallSuccessRate).toBe(0)
    expect(rapport.aiFallbackRate).toBe(0)
    expect(rapport.bySupplier).toEqual([])
    expect(formatCorpusReport(rapport)).toContain('Aucune fiche mesurée')
  })

  it('rend un rapport lisible', () => {
    const rendu = formatCorpusReport(buildCorpusReport(mesures))
    expect(rendu).toContain('Fiches mesurées : 3')
    expect(rendu).toContain('taux de réussite      66,7 %')
    expect(rendu).toContain('DEMO Maison des Parfums')
  })
})
