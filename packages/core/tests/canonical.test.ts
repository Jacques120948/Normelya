import { describe, expect, it } from 'vitest'
import { canonicalJson } from '../src/canonical'

describe('sérialisation canonique', () => {
  it('produit la même chaîne quel que soit l’ordre des clés', () => {
    // Sans cela, deux objets équivalents donneraient deux empreintes
    // différentes, et l'attestation ne prouverait plus rien.
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }))
    expect(canonicalJson({ x: { p: 1, q: 2 } })).toBe(canonicalJson({ x: { q: 2, p: 1 } }))
  })

  it('conserve l’ordre des tableaux, qui porte du sens', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })

  it('traite une clé absente et une clé indéfinie de la même façon', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }))
  })

  it('distingue une clé absente d’une clé nulle', () => {
    expect(canonicalJson({ a: 1, b: null })).not.toBe(canonicalJson({ a: 1 }))
  })

  it('normalise les dates', () => {
    const date = new Date('2026-03-12T10:00:00.000Z')
    expect(canonicalJson({ d: date })).toBe('{"d":"2026-03-12T10:00:00.000Z"}')
  })

  it('ne distingue pas zéro de zéro négatif', () => {
    expect(canonicalJson({ n: 0 })).toBe(canonicalJson({ n: -0 }))
  })

  it('refuse une valeur non finie plutôt que de produire une empreinte fausse', () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(/non finie/)
    expect(() => canonicalJson({ n: Number.POSITIVE_INFINITY })).toThrow(/non finie/)
  })

  it('produit un résultat stable sur une structure imbriquée réaliste', () => {
    const fiche = {
      versionLabel: '2.0',
      commercialName: 'DEMO Parfum',
      substances: [
        { casNumber: '78-70-6', declaredName: 'DEMO A', concentrationMax: 10 },
        { declaredName: 'DEMO B', concentrationMax: 1, casNumber: '7647-14-5' },
      ],
    }
    const autreOrdre = {
      substances: [
        { declaredName: 'DEMO A', concentrationMax: 10, casNumber: '78-70-6' },
        { concentrationMax: 1, casNumber: '7647-14-5', declaredName: 'DEMO B' },
      ],
      commercialName: 'DEMO Parfum',
      versionLabel: '2.0',
    }
    expect(canonicalJson(fiche)).toBe(canonicalJson(autreOrdre))
  })
})
