import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Utilitaires de hachage.
 *
 * Les adresses IP et les agents utilisateur ne sont jamais conservés en clair :
 * seule une empreinte salée est stockée, suffisante pour corréler des actions
 * sans identifier un visiteur (minimisation RGPD).
 */

/** Sel d'application, distinct par environnement. */
function applicationSalt(): string {
  return process.env.HASH_SALT ?? 'normelya-sel-de-developpement'
}

export function hashIdentifier(value: string | null | undefined): string | null {
  if (!value) return null
  return createHash('sha256').update(`${applicationSalt()}:${value}`).digest('hex')
}

export function sha256Hex(input: Uint8Array | string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** Jeton opaque, pour une invitation ou un lien à usage unique. */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url')
}

/**
 * Comparaison à temps constant. Utilisée pour les jetons : une comparaison
 * naïve laisse fuir la longueur du préfixe correct.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}
