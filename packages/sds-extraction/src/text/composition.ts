import { findCasNumbers, findEcNumbers, extractCodes } from './identifiers'

/**
 * Lecture du tableau de composition d'une fiche de données de sécurité.
 *
 * Ce module transforme du texte en données structurées. Il n'interprète rien :
 * une concentration reste la plage déclarée par le fournisseur, une
 * classification reste la chaîne écrite dans le document. La décision de
 * retenir la borne haute appartient au moteur réglementaire, pas au lecteur.
 */

export type ConcentrationReading = {
  /** Texte d'origine, conservé pour l'écran de vérification. */
  raw: string
  min: number | null
  max: number | null
  exact: number | null
  /** Comparateur rencontré, le cas échéant : « < », « ≤ », « > », « ≥ ». */
  operator: '<' | '<=' | '>' | '>=' | null
}

/** Nombre décimal écrit à la française ou à l'anglaise. */
const NOMBRE = String.raw`\d{1,3}(?:[.,]\d{1,6})?`

const PLAGE = new RegExp(
  String.raw`(?:^|[^\d])(${NOMBRE})\s*(?:-|–|—|\.\.\.|à|to|bis)\s*(${NOMBRE})\s*%`,
  'i',
)
const COMPARATEUR = new RegExp(String.raw`(<=|>=|≤|≥|<|>)\s*(${NOMBRE})\s*%`)
const VALEUR_SIMPLE = new RegExp(String.raw`(?:^|[^\d<>≤≥-])(${NOMBRE})\s*%`)

function nombre(texte: string): number {
  return Number(texte.replace(',', '.'))
}

/**
 * Lit une concentration déclarée.
 *
 * Renvoie null si aucune valeur n'est exploitable : un champ vide est préférable
 * à une valeur devinée, et l'écran de vérification demandera la saisie.
 */
export function parseConcentration(texte: string): ConcentrationReading | null {
  const propre = texte.replace(/\s+/g, ' ').trim()
  if (propre.length === 0) return null

  const plage = PLAGE.exec(propre)
  if (plage) {
    const min = nombre(plage[1]!)
    const max = nombre(plage[2]!)
    if (min > max) return null
    return { raw: propre, min, max, exact: null, operator: null }
  }

  const comparateur = COMPARATEUR.exec(propre)
  if (comparateur) {
    const valeur = nombre(comparateur[2]!)
    const signe = comparateur[1]!
    const normalise = signe === '≤' ? '<=' : signe === '≥' ? '>=' : (signe as '<' | '>' | '<=' | '>=')
    // « < 1 % » borne le maximum ; « ≥ 10 % » borne le minimum. Aucune des deux
    // écritures ne donne une valeur exacte.
    if (normalise === '<' || normalise === '<=') {
      return { raw: propre, min: null, max: valeur, exact: null, operator: normalise }
    }
    return { raw: propre, min: valeur, max: null, exact: null, operator: normalise }
  }

  const simple = VALEUR_SIMPLE.exec(propre)
  if (simple) {
    const valeur = nombre(simple[1]!)
    return { raw: propre, min: null, max: null, exact: valeur, operator: null }
  }

  return null
}

export type CompositionRow = {
  /** Ligne d'origine, conservée pour permettre la vérification humaine. */
  raw: string
  /** Dénomination telle qu'écrite, une fois les identifiants retirés. */
  declaredName: string | null
  casNumber: string | null
  casValid: boolean
  ecNumber: string | null
  ecValid: boolean
  concentration: ConcentrationReading | null
  /** Codes relevés sur la ligne, sans interprétation. */
  hazardStatements: string[]
  /** Texte de classification tel qu'écrit, hors codes. */
  classificationText: string | null
}

/**
 * Reconstitue les lignes du tableau de composition à partir du corps de la
 * rubrique 3.
 *
 * Principe : une ligne de composant se reconnaît à la présence d'un numéro CAS
 * ou CE. Les lignes intermédiaires sans identifiant sont rattachées à la ligne
 * précédente, car les tableaux exportés en texte cassent souvent les cellules
 * sur plusieurs lignes.
 */
export function parseCompositionRows(corpsRubrique3: string): CompositionRow[] {
  const lignes = corpsRubrique3.split(/\r?\n/)
  const groupes: string[] = []

  for (const ligne of lignes) {
    const contientIdentifiant =
      findCasNumbers(ligne).length > 0 || findEcNumbers(ligne).length > 0

    if (contientIdentifiant) {
      groupes.push(ligne)
      continue
    }

    // Rattachement au composant en cours, si la ligne porte une information.
    if (groupes.length > 0 && ligne.trim().length > 0) {
      groupes[groupes.length - 1] += ` ${ligne.trim()}`
    }
  }

  return groupes.map(lireLigne).filter((ligne): ligne is CompositionRow => ligne !== null)
}

function lireLigne(ligne: string): CompositionRow | null {
  const cas = findCasNumbers(ligne)[0] ?? null
  const ce = findEcNumbers(ligne)[0] ?? null
  if (!cas && !ce) return null

  const codes = extractCodes(ligne)

  // Le nom est ce qui reste une fois retirés les identifiants, les
  // concentrations et les codes.
  let reste = ligne
  for (const valeur of [cas?.value, ce?.value]) {
    if (valeur) reste = reste.replace(valeur, ' ')
  }
  for (const code of [...codes.hazardStatements, ...codes.euhStatements]) {
    reste = reste.replace(code, ' ')
  }

  const concentration = parseConcentration(ligne)
  if (concentration) reste = reste.replace(concentration.raw, ' ')

  const nom = nettoyerNom(reste)
  const classification = lireClassification(ligne, codes.hazardStatements)

  return {
    raw: ligne.trim(),
    declaredName: nom,
    casNumber: cas?.value ?? null,
    casValid: cas?.valid ?? false,
    ecNumber: ce?.value ?? null,
    ecValid: ce?.valid ?? false,
    concentration,
    hazardStatements: codes.hazardStatements,
    classificationText: classification,
  }
}

function nettoyerNom(texte: string): string | null {
  const propre = texte
    // Séparateurs de colonnes et ponctuation résiduelle.
    .replace(/[|;]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–—-]+|[\s,.;:–—-]+$/g, '')
    .trim()

  if (propre.length < 2) return null
  // Un reste purement numérique n'est pas un nom de substance.
  if (!/[A-Za-zÀ-ÿ]/.test(propre)) return null
  return propre
}

/**
 * Relève le texte de classification, c'est-à-dire ce qui précède le premier
 * code de mention de danger sur la ligne. Aucune tentative d'interprétation.
 */
function lireClassification(ligne: string, codes: string[]): string | null {
  const premier = codes[0]
  if (!premier) return null

  const position = ligne.indexOf(premier)
  if (position <= 0) return null

  const avant = ligne.slice(0, position)
  // On ne garde que le dernier fragment, après le dernier séparateur de colonne.
  const fragment = avant.split(/[|;]/).pop() ?? avant
  const propre = fragment.replace(/\s{2,}/g, ' ').replace(/[\s,;:-]+$/g, '').trim()

  return propre.length >= 2 ? propre : null
}
