/**
 * Sérialisation canonique.
 *
 * Une empreinte n'a de valeur probante que si elle est reproductible. Or
 * `JSON.stringify` conserve l'ordre d'insertion des clés : deux objets
 * équivalents produisent alors deux chaînes différentes, donc deux empreintes
 * différentes, et la preuve ne vaut plus rien.
 *
 * Cette fonction trie les clés à tous les niveaux et normalise les valeurs, de
 * sorte que deux structures équivalentes donnent exactement la même chaîne.
 */

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normaliser(value))
}

function normaliser(value: unknown): unknown {
  if (value === null || value === undefined) return null

  if (Array.isArray(value)) {
    // L'ordre d'un tableau porte du sens : il est conservé tel quel.
    return value.map(normaliser)
  }

  if (value instanceof Date) return value.toISOString()

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Une valeur non finie ne peut pas être sérialisée : ${String(value)}`)
    }
    // -0 et 0 doivent produire la même empreinte.
    return value === 0 ? 0 : value
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const trie: Record<string, unknown> = {}
    for (const cle of Object.keys(source).sort()) {
      // Une clé absente et une clé à undefined sont équivalentes.
      if (source[cle] === undefined) continue
      trie[cle] = normaliser(source[cle])
    }
    return trie
  }

  return value
}
