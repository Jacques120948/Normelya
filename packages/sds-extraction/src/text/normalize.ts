/**
 * Normalisation typographique pour la recherche d'étiquettes.
 *
 * Le texte extrait d'un PDF emploie des caractères typographiques que personne
 * ne saisit au clavier : apostrophe courbe, espace insécable, tiret demi-cadratin.
 * Chercher « point d'éclair » avec une apostrophe droite dans « Point d’éclair »
 * échoue silencieusement — un défaut invisible en test synthétique et
 * systématique sur un document réel.
 *
 * Contrainte de conception : la normalisation est STRICTEMENT caractère par
 * caractère. Un caractère entre, un caractère sort. Les positions restent donc
 * alignées sur le texte d'origine, ce qui permet de rechercher sur le texte
 * normalisé puis de découper sur le texte original — et donc de restituer à
 * l'utilisateur l'extrait exact du document.
 *
 * Une normalisation Unicode NFD ne conviendrait pas : elle décompose « é » en
 * deux caractères et décale toutes les positions suivantes.
 */

/** Correspondances lettre accentuée vers lettre de base, une pour une. */
const LETTRES: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ý: 'y', ÿ: 'y',
  À: 'A', Á: 'A', Â: 'A', Ã: 'A', Ä: 'A', Å: 'A',
  È: 'E', É: 'E', Ê: 'E', Ë: 'E',
  Ì: 'I', Í: 'I', Î: 'I', Ï: 'I',
  Ò: 'O', Ó: 'O', Ô: 'O', Õ: 'O', Ö: 'O',
  Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U',
  Ç: 'C', Ñ: 'N', Ý: 'Y',
}

/** Ponctuation typographique ramenée à sa forme saisissable au clavier. */
const PONCTUATION: Record<string, string> = {
  '’': "'", // apostrophe courbe
  '‘': "'",
  '‛': "'",
  'ʼ': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  ' ': ' ', // espace insécable
  ' ': ' ', // espace fine insécable
  ' ': ' ',
  ' ': ' ',
  '–': '-', // tiret demi-cadratin
  '—': '-', // tiret cadratin
  '−': '-', // signe moins
  '­': '-', // trait d'union conditionnel
}

/**
 * Replie un texte pour la comparaison : minuscules, sans accents, ponctuation
 * uniformisée. La longueur est rigoureusement conservée.
 */
export function foldForMatching(texte: string): string {
  let resultat = ''
  for (const caractere of texte) {
    const sansAccent = LETTRES[caractere] ?? PONCTUATION[caractere] ?? caractere
    resultat += sansAccent.toLowerCase()
  }
  return resultat
}

/**
 * Uniformise la ponctuation typographique d'un texte destiné à être analysé,
 * sans toucher aux accents ni à la casse. Longueur conservée également.
 */
export function normalizeTypography(texte: string): string {
  let resultat = ''
  for (const caractere of texte) {
    resultat += PONCTUATION[caractere] ?? caractere
  }
  return resultat
}
