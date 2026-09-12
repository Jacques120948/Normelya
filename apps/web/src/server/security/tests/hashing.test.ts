import { describe, expect, it } from 'vitest'
import { generateToken, hashIdentifier, safeCompare, sha256Hex } from '../hashing'

describe('hachage', () => {
  it('ne conserve jamais une adresse IP en clair', () => {
    const empreinte = hashIdentifier('192.168.1.42')
    expect(empreinte).not.toBeNull()
    expect(empreinte).not.toContain('192.168')
    expect(empreinte).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produit la même empreinte pour la même valeur', () => {
    expect(hashIdentifier('192.168.1.42')).toBe(hashIdentifier('192.168.1.42'))
    expect(hashIdentifier('192.168.1.42')).not.toBe(hashIdentifier('192.168.1.43'))
  })

  it('renvoie null pour une valeur absente', () => {
    expect(hashIdentifier(null)).toBeNull()
    expect(hashIdentifier(undefined)).toBeNull()
    expect(hashIdentifier('')).toBeNull()
  })

  it('calcule une empreinte de document sur 64 caractères hexadécimaux', () => {
    expect(sha256Hex('contenu')).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('génère des jetons distincts et sans caractère problématique en URL', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(a.length).toBeGreaterThanOrEqual(40)
  })

  it('compare deux jetons à temps constant', () => {
    expect(safeCompare('jeton', 'jeton')).toBe(true)
    expect(safeCompare('jeton', 'jetom')).toBe(false)
    expect(safeCompare('jeton', 'jetons')).toBe(false)
  })
})
