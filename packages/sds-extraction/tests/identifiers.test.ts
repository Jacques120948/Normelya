import { describe, expect, it } from 'vitest'
import {
  extractCodes,
  findCasNumbers,
  findEcNumbers,
  isValidCasNumber,
  isValidEcNumber,
} from '../src/text/identifiers'

/**
 * Ces tests portent sur de l'arithmétique et sur des formes d'écriture.
 * Aucun n'affirme quoi que ce soit sur une substance ou sur une réglementation.
 */

describe('numéro CAS', () => {
  it('accepte un numéro dont la clé de contrôle est juste', () => {
    // 0×1 + 7×2 + 8×3 + 7×4 = 66, dont le reste modulo 10 vaut 6.
    expect(isValidCasNumber('78-70-6')).toBe(true)
    // 4×1 + 1×2 + 7×3 + 4×4 + 6×5 + 7×6 = 115, reste 5.
    expect(isValidCasNumber('7647-14-5')).toBe(true)
  })

  it('refuse un numéro dont la clé est fausse', () => {
    expect(isValidCasNumber('78-70-5')).toBe(false)
    expect(isValidCasNumber('78-70-0')).toBe(false)
  })

  it('refuse une forme incorrecte', () => {
    for (const invalide of ['78-7-6', '7-70-6', '78706', 'CAS 78-70-6', '', 'abc-de-f']) {
      expect(isValidCasNumber(invalide), invalide).toBe(false)
    }
  })

  it('tolère les espaces autour du numéro', () => {
    expect(isValidCasNumber('  78-70-6  ')).toBe(true)
  })

  it('refuse une clé hors intervalle sur le second bloc', () => {
    // Le second bloc compte exactement deux chiffres.
    expect(isValidCasNumber('100001-0-7')).toBe(false)
  })
})

describe('numéro CE', () => {
  it('accepte un numéro dont la clé de contrôle est juste', () => {
    // 2×1 + 0×2 + 1×3 + 1×4 + 3×5 + 4×6 = 48, reste 4 modulo 11.
    expect(isValidEcNumber('201-134-4')).toBe(true)
  })

  it('refuse un numéro dont la clé est fausse', () => {
    expect(isValidEcNumber('201-134-5')).toBe(false)
    expect(isValidEcNumber('201-134-0')).toBe(false)
  })

  it('refuse une forme incorrecte', () => {
    for (const invalide of ['201-13-4', '2011-134-4', '201134 4', '']) {
      expect(isValidEcNumber(invalide), invalide).toBe(false)
    }
  })
})

describe('relevé des identifiants dans un texte', () => {
  it('remonte les numéros invalides plutôt que de les écarter en silence', () => {
    const releve = findCasNumbers('Composant A 78-70-6, composant B 78-70-5')
    expect(releve).toEqual([
      { value: '78-70-6', valid: true },
      { value: '78-70-5', valid: false },
    ])
  })

  it('élimine les doublons en conservant l’ordre d’apparition', () => {
    const releve = findCasNumbers('78-70-6 puis 7647-14-5 puis 78-70-6')
    expect(releve.map((r) => r.value)).toEqual(['78-70-6', '7647-14-5'])
  })

  it('ne confond pas un numéro CE avec un numéro CAS', () => {
    // Les deux blocs d'un numéro CE comptent trois chiffres : la forme diffère.
    expect(findCasNumbers('201-134-4')).toEqual([])
  })

  it('relève les numéros CE', () => {
    const releve = findEcNumbers('Numéro CE : 201-134-4')
    expect(releve).toEqual([{ value: '201-134-4', valid: true }])
  })
})

describe('codes de mentions et de conseils', () => {
  it('relève les codes de mentions de danger', () => {
    const codes = extractCodes('Classification : Skin Sens. 1, H317 ; Aquatic Chronic 3, H412')
    expect(codes.hazardStatements).toEqual(['H317', 'H412'])
  })

  it('ne confond pas EUH208 avec un code de mention de danger', () => {
    const codes = extractCodes('Mentions : H317, EUH208, H412')
    expect(codes.euhStatements).toEqual(['EUH208'])
    expect(codes.hazardStatements).toEqual(['H317', 'H412'])
    expect(codes.hazardStatements).not.toContain('H208')
  })

  it('relève les codes de conseils, y compris combinés', () => {
    const codes = extractCodes('P102, P301 + P310, P280')
    expect(codes.precautionaryStatements).toEqual(['P102', 'P301+P310', 'P280'])
  })

  it('normalise les espaces autour du signe de combinaison', () => {
    const sansEspace = extractCodes('P301+P310')
    const avecEspaces = extractCodes('P301 + P310')
    expect(sansEspace.precautionaryStatements).toEqual(avecEspaces.precautionaryStatements)
  })

  it('accepte les suffixes littéraux des codes', () => {
    const codes = extractCodes('H350i et H360FD apparaissent dans ce document')
    expect(codes.hazardStatements).toEqual(['H350i', 'H360FD'])
  })

  it('produit exactement le même relevé pour un même texte', () => {
    const texte = 'H317 EUH208 P280 H317 P301+P310'
    expect(extractCodes(texte)).toEqual(extractCodes(texte))
  })

  it('ne relève rien dans un texte qui n’en contient pas', () => {
    const codes = extractCodes('Point éclair : 93 °C. Densité : 0,89 g/ml.')
    expect(codes.hazardStatements).toEqual([])
    expect(codes.euhStatements).toEqual([])
    expect(codes.precautionaryStatements).toEqual([])
  })
})
