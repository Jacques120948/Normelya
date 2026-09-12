import { describe, expect, it } from 'vitest'
import { extractFromText } from '../src/text/pipeline'

/**
 * Fiche DEMO complète, écrite pour tester la lecture.
 * Aucune de ces valeurs n'affirme quoi que ce soit sur une substance réelle.
 */
const FICHE_COMPLETE = `
FICHE DE DONNÉES DE SÉCURITÉ

RUBRIQUE 1 : Identification de la substance/du mélange et de la société
1.1 Identificateur de produit
Nom commercial : DEMO Parfum Fleur d'essai
1.3 Renseignements concernant le fournisseur
Fournisseur : DEMO Maison des Parfums

RUBRIQUE 2 : Identification des dangers
Classification : Skin Sens. 1, H317 ; Aquatic Chronic 3, H412
Mentions additionnelles : EUH208
Conseils de prudence : P280, P302 + P352

RUBRIQUE 3 : Composition/informations sur les composants
3.2 Mélanges
Nom | N° CAS | N° CE | Concentration | Classification
DEMO Substance A | 78-70-6 | 201-134-4 | 5 - 10 % | Skin Sens. 1 H317
DEMO Substance B | 7647-14-5 | < 1 % | Aquatic Chronic 3 H412

RUBRIQUE 9 : Propriétés physiques et chimiques
Point d'éclair : 93 °C

RUBRIQUE 16 : Autres informations
Version : 2.0
Date de révision : 12/03/2026
`

describe('lecture complète d’une fiche', () => {
  const resultat = extractFromText(FICHE_COMPLETE)

  it('lit les champs d’en-tête avec une confiance élevée', () => {
    expect(resultat.productName).toMatchObject({
      value: "DEMO Parfum Fleur d'essai",
      confidence: 'high',
      foundInSection: 1,
    })
    expect(resultat.supplierName.value).toBe('DEMO Maison des Parfums')
    expect(resultat.versionLabel.value).toBe('2.0')
    expect(resultat.revisionDate.value).toBe('2026-03-12')
  })

  it('lit le point éclair depuis la rubrique attendue', () => {
    expect(resultat.flashPointCelsius).toMatchObject({
      value: 93,
      confidence: 'high',
      foundInSection: 9,
    })
  })

  it('relève les codes de la rubrique 2 sans les interpréter', () => {
    expect(resultat.hazardStatements.value).toEqual(['H317', 'H412'])
    expect(resultat.euhStatements.value).toEqual(['EUH208'])
    expect(resultat.precautionaryStatements.value).toEqual(['P280', 'P302+P352'])
  })

  it('lit les deux lignes de composition', () => {
    expect(resultat.composition.rows).toHaveLength(2)
    expect(resultat.composition.rows[0]).toMatchObject({
      casNumber: '78-70-6',
      casValid: true,
      ecNumber: '201-134-4',
    })
    expect(resultat.composition.rows[0]!.concentration).toMatchObject({ min: 5, max: 10 })
    expect(resultat.composition.rows[1]!.concentration).toMatchObject({ max: 1, operator: '<' })
  })

  it('ne signale aucune incohérence sur une fiche saine', () => {
    const bloquantes = resultat.issues.filter(
      (issue) => issue.code !== 'missing_section',
    )
    expect(bloquantes).toEqual([])
  })

  it('mesure la complétude', () => {
    expect(resultat.completeness).toBe(1)
  })

  it('produit exactement le même résultat pour un même document', () => {
    expect(extractFromText(FICHE_COMPLETE)).toEqual(extractFromText(FICHE_COMPLETE))
  })
})

describe('contrôles de cohérence', () => {
  it('signale une somme de concentrations supérieure à 100 %', () => {
    const resultat = extractFromText(
      `RUBRIQUE 3 : Composition\nDEMO A 78-70-6 60 %\nDEMO B 7647-14-5 50 %`,
    )
    const alerte = resultat.issues.find((i) => i.code === 'concentration_sum_exceeds_100')
    expect(alerte?.message).toContain('110,00 %')
  })

  it('signale un numéro CAS dont la clé est fausse', () => {
    const resultat = extractFromText('RUBRIQUE 3 : Composition\nDEMO A 78-70-5 1 %')
    const alerte = resultat.issues.find((i) => i.code === 'invalid_cas_checksum')
    expect(alerte?.subject).toBe('78-70-5')
  })

  it('signale un code annoncé en rubrique 2 mais absent de la composition', () => {
    const resultat = extractFromText(
      `RUBRIQUE 2 : Dangers\nH317 et H400\nRUBRIQUE 3 : Composition\nDEMO A 78-70-6 1 % H317`,
    )
    const alerte = resultat.issues.find((i) => i.code === 'code_absent_from_composition')
    expect(alerte?.subject).toBe('H400')
  })

  it('signale une composition illisible plutôt que de la compléter', () => {
    const resultat = extractFromText('RUBRIQUE 3 : Composition\nSecret commercial')
    expect(resultat.issues.some((i) => i.code === 'composition_incomplete')).toBe(true)
    expect(resultat.composition.rows).toEqual([])
  })

  it('signale les rubriques indispensables manquantes', () => {
    const resultat = extractFromText('RUBRIQUE 1 : Identification\nNom commercial : DEMO')
    const manquantes = resultat.issues
      .filter((i) => i.code === 'missing_section')
      .map((i) => i.subject)
    expect(manquantes).toEqual(['2', '3', '9', '16'])
  })
})

describe('fiche partiellement lisible', () => {
  it('abaisse la confiance d’un champ trouvé hors de sa rubrique', () => {
    // La date figure en en-tête, pas en rubrique 16.
    const resultat = extractFromText(
      `Date de révision : 12/03/2026\nRUBRIQUE 16 : Autres informations\nAucune`,
    )
    expect(resultat.revisionDate).toMatchObject({
      value: '2026-03-12',
      confidence: 'medium',
      foundInSection: null,
    })
  })

  it('abaisse la confiance sur un point éclair exprimé comme une borne', () => {
    const resultat = extractFromText(
      `RUBRIQUE 9 : Propriétés\nPoint d'éclair : > 100 °C`,
    )
    expect(resultat.flashPointCelsius).toMatchObject({ value: 100, confidence: 'low' })
  })

  it('laisse les champs absents à null, sans valeur de repli', () => {
    const resultat = extractFromText('Document illisible')
    expect(resultat.productName.value).toBeNull()
    expect(resultat.revisionDate.value).toBeNull()
    expect(resultat.flashPointCelsius.value).toBeNull()
    expect(resultat.hazardStatements.value).toBeNull()
    expect(resultat.completeness).toBe(0)
  })
})
