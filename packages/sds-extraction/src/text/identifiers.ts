/**
 * Reconnaissance et validation des identifiants figurant dans une fiche de
 * données de sécurité.
 *
 * IMPORTANT — nature de ce module.
 *
 * Rien ici n'est une constante réglementaire. Ce module reconnaît des FORMES :
 *
 *   · un numéro CAS a une structure arithmétique vérifiable (clé de contrôle) ;
 *   · un numéro CE également ;
 *   · un code de mention de danger s'écrit « H » suivi de trois chiffres.
 *
 * Un code reconnu ici est une CHAÎNE EXTRAITE, pas une affirmation
 * réglementaire. Ce module ne sait pas ce que signifie H317, ne possède aucune
 * liste officielle de codes, et n'en validera jamais la pertinence. Cette
 * interprétation appartient au moteur réglementaire, qui ne travaille que sur
 * des données validées par un humain.
 */

/* --------------------------------------------------------------- Numéro CAS */

const CAS_FORME = /^(\d{2,7})-(\d{2})-(\d)$/

/**
 * Vérifie la clé de contrôle d'un numéro CAS.
 *
 * Règle arithmétique : en partant du chiffre le plus à droite (hors clé), on
 * multiplie chaque chiffre par son rang (1, 2, 3, …) ; la clé est le reste de
 * la somme modulo 10.
 *
 * Exemple vérifiable à la main — 78-70-6 :
 *   chiffres hors clé, de droite à gauche : 0, 7, 8, 7
 *   0×1 + 7×2 + 8×3 + 7×4 = 0 + 14 + 24 + 28 = 66
 *   66 mod 10 = 6, qui est bien la clé.
 */
export function isValidCasNumber(candidat: string): boolean {
  const correspondance = CAS_FORME.exec(candidat.trim())
  if (!correspondance) return false

  const [, bloc1, bloc2, cle] = correspondance
  const chiffres = `${bloc1}${bloc2}`.split('').reverse()

  let somme = 0
  chiffres.forEach((chiffre, index) => {
    somme += Number(chiffre) * (index + 1)
  })

  return somme % 10 === Number(cle)
}

/* ---------------------------------------------------------------- Numéro CE */

const CE_FORME = /^(\d{3})-(\d{3})-(\d)$/

/**
 * Vérifie la clé de contrôle d'un numéro CE.
 *
 * Règle arithmétique : les six premiers chiffres sont pondérés de 1 à 6 de
 * gauche à droite ; la clé est le reste de la somme modulo 11.
 *
 * Exemple vérifiable à la main — 201-134-4 :
 *   2×1 + 0×2 + 1×3 + 1×4 + 3×5 + 4×6 = 2 + 0 + 3 + 4 + 15 + 24 = 48
 *   48 mod 11 = 4, qui est bien la clé.
 */
export function isValidEcNumber(candidat: string): boolean {
  const correspondance = CE_FORME.exec(candidat.trim())
  if (!correspondance) return false

  const [, bloc1, bloc2, cle] = correspondance
  const chiffres = `${bloc1}${bloc2}`.split('')

  let somme = 0
  chiffres.forEach((chiffre, index) => {
    somme += Number(chiffre) * (index + 1)
  })

  const reste = somme % 11
  // Un reste de 10 ne peut pas s'écrire sur un seul chiffre : le numéro
  // correspondant n'est jamais attribué.
  if (reste === 10) return false

  return reste === Number(cle)
}

/* ------------------------------------------------- Codes de mentions et conseils */

/**
 * Formes des codes rencontrés dans une fiche.
 *
 * Ces expressions décrivent une ÉCRITURE, pas un contenu. Les combinaisons
 * (« P301+P310 ») sont reconnues comme un seul code, telles qu'elles sont
 * écrites dans le document.
 */
const HAZARD_CODE = /\bH\d{3}[A-Za-z]{0,2}\b/g
const EUH_CODE = /\bEUH\d{3}[A-Za-z]?\b/g
const PRECAUTION_CODE = /\bP\d{3}(?:\s*\+\s*P\d{3})*\b/g

export type ExtractedCodes = {
  hazardStatements: string[]
  euhStatements: string[]
  precautionaryStatements: string[]
}

/**
 * Relève les codes présents dans un texte, sans les interpréter.
 *
 * Les doublons sont éliminés et l'ordre d'apparition est conservé : deux
 * extractions du même document doivent produire exactement la même liste.
 */
export function extractCodes(texte: string): ExtractedCodes {
  return {
    // EUH est relevé avant H pour que « EUH208 » ne soit pas coupé en « H208 ».
    euhStatements: releverUnique(texte, EUH_CODE),
    hazardStatements: releverUnique(texteSansEuh(texte), HAZARD_CODE),
    precautionaryStatements: releverUnique(texte, PRECAUTION_CODE).map(normaliserCombinaison),
  }
}

function texteSansEuh(texte: string): string {
  return texte.replace(/\bEUH\d{3}[A-Za-z]?\b/g, ' ')
}

function releverUnique(texte: string, motif: RegExp): string[] {
  const vus = new Set<string>()
  const resultats: string[] = []
  for (const correspondance of texte.matchAll(new RegExp(motif.source, motif.flags))) {
    const valeur = correspondance[0].trim()
    if (!vus.has(valeur)) {
      vus.add(valeur)
      resultats.push(valeur)
    }
  }
  return resultats
}

/** « P301 + P310 » et « P301+P310 » désignent le même code. */
function normaliserCombinaison(code: string): string {
  return code.replace(/\s*\+\s*/g, '+')
}

/* ------------------------------------------------------ Relevé des identifiants */

export type IdentifierFinding = {
  value: string
  /** Vrai si la clé de contrôle est correcte. */
  valid: boolean
}

/**
 * Relève les numéros CAS d'un texte et indique lesquels sont arithmétiquement
 * valides. Un numéro dont la clé est fausse n'est pas silencieusement écarté :
 * il est remonté comme invalide, pour que l'utilisateur puisse le corriger.
 */
export function findCasNumbers(texte: string): IdentifierFinding[] {
  return relever(texte, /\b\d{2,7}-\d{2}-\d\b/g, isValidCasNumber)
}

export function findEcNumbers(texte: string): IdentifierFinding[] {
  return relever(texte, /\b\d{3}-\d{3}-\d\b/g, isValidEcNumber)
}

function relever(
  texte: string,
  motif: RegExp,
  valider: (valeur: string) => boolean,
): IdentifierFinding[] {
  const vus = new Set<string>()
  const resultats: IdentifierFinding[] = []
  for (const correspondance of texte.matchAll(motif)) {
    const valeur = correspondance[0]
    if (vus.has(valeur)) continue
    vus.add(valeur)
    resultats.push({ value: valeur, valid: valider(valeur) })
  }
  return resultats
}
