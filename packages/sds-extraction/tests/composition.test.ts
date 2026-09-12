import { describe, expect, it } from 'vitest'
import { parseCompositionRows, parseConcentration } from '../src/text/composition'

/**
 * Tous les exemples de ce fichier sont des textes de test marqués DEMO.
 * Ils servent à valider un travail de lecture, pas à affirmer une classification.
 */

describe('lecture d’une concentration', () => {
  it('lit une plage et conserve ses deux bornes', () => {
    expect(parseConcentration('5 - 10 %')).toMatchObject({ min: 5, max: 10, exact: null })
    expect(parseConcentration('5–10%')).toMatchObject({ min: 5, max: 10 })
    expect(parseConcentration('1 à 2,5 %')).toMatchObject({ min: 1, max: 2.5 })
  })

  it('ne calcule jamais de valeur médiane', () => {
    const lecture = parseConcentration('5 - 10 %')
    expect(lecture?.exact).toBeNull()
  })

  it('lit une valeur exacte', () => {
    expect(parseConcentration('9 %')).toMatchObject({ exact: 9, min: null, max: null })
    expect(parseConcentration('0,25 %')).toMatchObject({ exact: 0.25 })
  })

  it('traite un comparateur comme une borne, pas comme une valeur', () => {
    expect(parseConcentration('< 1 %')).toMatchObject({ max: 1, exact: null, operator: '<' })
    expect(parseConcentration('≤ 0,1 %')).toMatchObject({ max: 0.1, operator: '<=' })
    expect(parseConcentration('≥ 10 %')).toMatchObject({ min: 10, operator: '>=' })
    expect(parseConcentration('> 25 %')).toMatchObject({ min: 25, operator: '>' })
  })

  it('conserve le texte d’origine pour la vérification humaine', () => {
    expect(parseConcentration('  5 -  10 %  ')?.raw).toBe('5 - 10 %')
  })

  it('renvoie null plutôt qu’une valeur devinée', () => {
    expect(parseConcentration('')).toBeNull()
    expect(parseConcentration('non communiqué')).toBeNull()
    expect(parseConcentration('secret commercial')).toBeNull()
  })

  it('refuse une plage incohérente', () => {
    expect(parseConcentration('10 - 5 %')).toBeNull()
  })
})

describe('lecture du tableau de composition', () => {
  it('lit une ligne complète', () => {
    const lignes = parseCompositionRows(
      'DEMO Substance A | 78-70-6 | 201-134-4 | 5 - 10 % | Skin Sens. 1 H317',
    )
    expect(lignes).toHaveLength(1)
    const ligne = lignes[0]!
    expect(ligne.casNumber).toBe('78-70-6')
    expect(ligne.casValid).toBe(true)
    expect(ligne.ecNumber).toBe('201-134-4')
    expect(ligne.ecValid).toBe(true)
    expect(ligne.concentration).toMatchObject({ min: 5, max: 10 })
    expect(ligne.hazardStatements).toEqual(['H317'])
    expect(ligne.declaredName).toContain('DEMO Substance A')
  })

  it('relève le texte de classification écrit avant le code', () => {
    const ligne = parseCompositionRows('DEMO B | 78-70-6 | 1 % | Skin Sens. 1 H317')[0]!
    expect(ligne.classificationText).toBe('Skin Sens. 1')
  })

  it('signale un numéro CAS dont la clé est fausse, sans l’écarter', () => {
    const ligne = parseCompositionRows('DEMO C | 78-70-5 | 1 %')[0]!
    expect(ligne.casNumber).toBe('78-70-5')
    expect(ligne.casValid).toBe(false)
  })

  it('rattache une cellule cassée sur plusieurs lignes', () => {
    const lignes = parseCompositionRows(
      ['DEMO Substance longue 78-70-6', '5 - 10 %', 'Skin Sens. 1 H317'].join('\n'),
    )
    expect(lignes).toHaveLength(1)
    expect(lignes[0]!.concentration).toMatchObject({ min: 5, max: 10 })
    expect(lignes[0]!.hazardStatements).toEqual(['H317'])
  })

  it('sépare plusieurs composants', () => {
    const lignes = parseCompositionRows(
      ['DEMO A 78-70-6 1 %', 'DEMO B 7647-14-5 2 %'].join('\n'),
    )
    expect(lignes.map((l) => l.casNumber)).toEqual(['78-70-6', '7647-14-5'])
  })

  it('ignore les lignes d’en-tête sans identifiant', () => {
    const lignes = parseCompositionRows(
      ['Nom | N° CAS | N° CE | Concentration', 'DEMO A 78-70-6 1 %'].join('\n'),
    )
    expect(lignes).toHaveLength(1)
  })

  it('ne rend aucune ligne quand la composition n’est pas exploitable', () => {
    expect(parseCompositionRows('Aucune substance dangereuse selon le fournisseur.')).toEqual([])
    expect(parseCompositionRows('')).toEqual([])
  })

  it('laisse le nom vide plutôt que d’inventer une dénomination', () => {
    const ligne = parseCompositionRows('78-70-6 5 - 10 %')[0]!
    expect(ligne.declaredName).toBeNull()
  })

  it('conserve la ligne d’origine pour l’écran de vérification', () => {
    const brut = 'DEMO A | 78-70-6 | 5 - 10 %'
    expect(parseCompositionRows(brut)[0]!.raw).toBe(brut)
  })

  it('produit exactement le même résultat pour un même texte', () => {
    const texte = 'DEMO A 78-70-6 5 - 10 % H317\nDEMO B 7647-14-5 < 1 %'
    expect(parseCompositionRows(texte)).toEqual(parseCompositionRows(texte))
  })
})
