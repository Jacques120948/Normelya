import { describe, expect, it } from 'vitest'
import { foldForMatching, normalizeTypography } from '../src/text/normalize'
import { parseFlashPoint, parseProductName } from '../src/text/fields'

describe('normalisation typographique', () => {
  it('conserve rigoureusement la longueur du texte', () => {
    // Garantie indispensable : les positions servent à découper le texte
    // d'origine pour restituer l'extrait exact à l'utilisateur.
    const exemples = [
      'Point d’éclair : 93 °C',
      'Concentration : 5 – 10 %',
      'Référence « DEMO »',
      'Été à Noël — çà et là',
    ]
    for (const exemple of exemples) {
      expect(foldForMatching(exemple), exemple).toHaveLength([...exemple].length)
      expect(normalizeTypography(exemple), exemple).toHaveLength([...exemple].length)
    }
  })

  it('ramène l’apostrophe courbe à l’apostrophe droite', () => {
    expect(foldForMatching('Point d’éclair')).toBe("point d'eclair")
    expect(normalizeTypography('Point d’éclair')).toBe("Point d'éclair")
  })

  it('ramène les espaces insécables à l’espace ordinaire', () => {
    expect(normalizeTypography('93 °C')).toBe('93 °C')
  })

  it('ramène les tirets typographiques au trait d’union', () => {
    expect(normalizeTypography('5 – 10 %')).toBe('5 - 10 %')
    expect(normalizeTypography('5 — 10 %')).toBe('5 - 10 %')
  })

  it('replie les accents sans toucher au reste', () => {
    expect(foldForMatching('Référence')).toBe('reference')
    expect(foldForMatching('ÉTÉ')).toBe('ete')
    expect(foldForMatching('Çà')).toBe('ca')
  })
})

describe('robustesse des étiquettes sur du texte réel', () => {
  it('trouve le point éclair écrit avec une apostrophe courbe', () => {
    // Non-régression : cette écriture est celle produite par les PDF réels.
    expect(parseFlashPoint('Point d’éclair : 93 °C')?.value).toBe(93)
    expect(parseFlashPoint('Point d’eclair : 93 C')?.value).toBe(93)
  })

  it('ne décale pas l’extrait quand la ligne contient des accents avant l’étiquette', () => {
    // Non-régression : une normalisation qui raccourcirait le texte décalerait
    // les positions et tronquerait la valeur restituée.
    const lecture = parseProductName('Référence interne — Nom commercial : DEMO Parfum')
    expect(lecture?.value).toBe('DEMO Parfum')
  })

  it('trouve une étiquette précédée de plusieurs mots accentués', () => {
    const lecture = parseFlashPoint('Propriétés générales évaluées — Point d’éclair : 61 °C')
    expect(lecture?.value).toBe(61)
    expect(lecture?.evidence).toBe('61 °C')
  })
})
