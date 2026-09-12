import { extractCodes } from './identifiers'
import { parseCompositionRows, type CompositionRow } from './composition'
import {
  parseFlashPoint,
  parseProductName,
  parseRevisionDate,
  parseSupplierName,
  parseVersionLabel,
  type FlashPointReading,
} from './fields'
import { normalizeTypography } from './normalize'
import { segmentSections, type SegmentationResult } from './segmentation'

/**
 * Lecture complète d'une fiche de données de sécurité, à partir de son texte.
 *
 * Ce module est entièrement déterministe : même texte, même résultat. Il ne
 * fait aucune entrée-sortie et ne connaît ni PDF, ni base de données, ni
 * modèle de langage.
 *
 * Rien de ce qu'il produit n'est considéré comme validé. Chaque champ porte un
 * niveau de confiance et l'extrait du document dont il provient, afin que
 * l'écran de vérification puisse montrer à l'utilisateur d'où vient la valeur.
 */

export type Confidence = 'high' | 'medium' | 'low'

export type ExtractedField<T> = {
  value: T | null
  confidence: Confidence
  /** Extrait du document justifiant la valeur. Vide si le champ est absent. */
  evidence: string | null
  /** Rubrique où la valeur a été trouvée, si connue. */
  foundInSection: number | null
}

export type ConsistencyIssue = {
  code:
    | 'concentration_sum_exceeds_100'
    | 'invalid_cas_checksum'
    | 'invalid_ec_checksum'
    | 'code_absent_from_composition'
    | 'composition_incomplete'
    | 'missing_section'
  message: string
  /** Élément concerné, pour le mettre en évidence à l'écran. */
  subject?: string
}

export type ExtractionOutcome = {
  productName: ExtractedField<string>
  supplierName: ExtractedField<string>
  revisionDate: ExtractedField<string>
  versionLabel: ExtractedField<string>
  flashPointCelsius: ExtractedField<number>
  /** Codes relevés en rubrique 2, tels qu'écrits. */
  hazardStatements: ExtractedField<string[]>
  euhStatements: ExtractedField<string[]>
  precautionaryStatements: ExtractedField<string[]>
  composition: {
    rows: CompositionRow[]
    confidence: Confidence
  }
  segmentation: SegmentationResult
  issues: ConsistencyIssue[]
  /** Part des champs attendus effectivement renseignés, entre 0 et 1. */
  completeness: number
  languageHint: string | null
}

const CHAMP_ABSENT: ExtractedField<never> = {
  value: null,
  confidence: 'low',
  evidence: null,
  foundInSection: null,
}

/**
 * Lit une fiche.
 *
 * Stratégie de recherche : chaque champ est d'abord cherché dans la rubrique où
 * il est attendu. À défaut, il est cherché dans tout le document, avec un
 * niveau de confiance abaissé — une valeur trouvée au mauvais endroit est
 * plausible, pas certaine.
 */
export function extractFromText(texteBrut: string): ExtractionOutcome {
  // Les PDF emploient une ponctuation typographique que personne ne saisit au
  // clavier. On l'uniformise sans toucher au contenu ni aux positions.
  const texte = normalizeTypography(texteBrut)
  const segmentation = segmentSections(texte)
  const rubrique = (numero: number) => segmentation.sections.get(numero)?.body ?? null

  const productName = lireChamp(texte, rubrique(1), 1, parseProductName)
  const supplierName = lireChamp(texte, rubrique(1), 1, parseSupplierName)
  const revisionDate = lireChamp(texte, rubrique(16), 16, parseRevisionDate)
  const versionLabel = lireChamp(texte, rubrique(16), 16, parseVersionLabel)

  const pointEclair = lireChampPointEclair(texte, rubrique(9))

  const corpsRubrique2 = rubrique(2)
  const codes = extractCodes(corpsRubrique2 ?? '')
  const confianceCodes: Confidence = corpsRubrique2 ? 'high' : 'low'

  const corpsRubrique3 = rubrique(3)
  const rows = corpsRubrique3 ? parseCompositionRows(corpsRubrique3) : []

  const issues = controlerCoherence({
    rows,
    codesRubrique2: codes.hazardStatements,
    segmentation,
  })

  const champs = [
    productName.value,
    supplierName.value,
    revisionDate.value,
    versionLabel.value,
    pointEclair.value,
    codes.hazardStatements.length > 0 ? codes.hazardStatements : null,
    rows.length > 0 ? rows : null,
  ]
  const renseignes = champs.filter((valeur) => valeur !== null).length

  return {
    productName,
    supplierName,
    revisionDate,
    versionLabel,
    flashPointCelsius: pointEclair,
    hazardStatements: champListe(codes.hazardStatements, confianceCodes, 2),
    euhStatements: champListe(codes.euhStatements, confianceCodes, 2),
    precautionaryStatements: champListe(codes.precautionaryStatements, confianceCodes, 2),
    composition: {
      rows,
      confidence: corpsRubrique3 ? (rows.length > 0 ? 'high' : 'low') : 'low',
    },
    segmentation,
    issues,
    completeness: renseignes / champs.length,
    languageHint: segmentation.detectedLanguageHint,
  }
}

function lireChamp<T>(
  documentEntier: string,
  corpsAttendu: string | null,
  numeroRubrique: number,
  lecteur: (texte: string) => { value: T; evidence: string } | null,
): ExtractedField<T> {
  if (corpsAttendu) {
    const trouve = lecteur(corpsAttendu)
    if (trouve) {
      return {
        value: trouve.value,
        confidence: 'high',
        evidence: trouve.evidence,
        foundInSection: numeroRubrique,
      }
    }
  }

  // Repli sur le document entier : plausible, donc confiance moyenne.
  const ailleurs = lecteur(documentEntier)
  if (ailleurs) {
    return {
      value: ailleurs.value,
      confidence: 'medium',
      evidence: ailleurs.evidence,
      foundInSection: null,
    }
  }

  return { ...CHAMP_ABSENT }
}

function lireChampPointEclair(
  documentEntier: string,
  corpsAttendu: string | null,
): ExtractedField<number> {
  const lire = (texte: string) => {
    const lecture: FlashPointReading | null = parseFlashPoint(texte)
    if (!lecture) return null
    return { value: lecture.value, evidence: lecture.evidence, operator: lecture.operator }
  }

  const champ = lireChamp(documentEntier, corpsAttendu, 9, lire)
  if (champ.value === null) return champ

  // Une borne (« > 100 °C ») n'est pas une mesure : la confiance est abaissée
  // pour que l'utilisateur tranche.
  const lecture = corpsAttendu ? lire(corpsAttendu) ?? lire(documentEntier) : lire(documentEntier)
  if (lecture?.operator) {
    return { ...champ, confidence: 'low' }
  }
  return champ
}

function champListe(
  valeurs: string[],
  confiance: Confidence,
  numeroRubrique: number,
): ExtractedField<string[]> {
  if (valeurs.length === 0) return { ...CHAMP_ABSENT, value: null }
  return {
    value: valeurs,
    confidence: confiance,
    evidence: valeurs.join(', '),
    foundInSection: numeroRubrique,
  }
}

/**
 * Contrôles de cohérence.
 *
 * Ils ne corrigent rien : ils signalent. C'est l'utilisateur qui tranche sur
 * l'écran de vérification.
 */
function controlerCoherence(input: {
  rows: CompositionRow[]
  codesRubrique2: string[]
  segmentation: SegmentationResult
}): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []

  // Somme des bornes hautes déclarées.
  let sommeHaute = 0
  for (const ligne of input.rows) {
    const concentration = ligne.concentration
    if (!concentration) continue
    const borne = concentration.max ?? concentration.exact ?? concentration.min
    if (borne !== null) sommeHaute += borne
  }
  if (sommeHaute > 100) {
    issues.push({
      code: 'concentration_sum_exceeds_100',
      message: `La somme des concentrations déclarées atteint ${sommeHaute.toFixed(2).replace('.', ',')} %, ce qui dépasse 100 %. Vérifiez le tableau de composition.`,
    })
  }

  for (const ligne of input.rows) {
    if (ligne.casNumber && !ligne.casValid) {
      issues.push({
        code: 'invalid_cas_checksum',
        message: `Le numéro CAS ${ligne.casNumber} ne passe pas son contrôle de cohérence. Vérifiez-le sur la fiche.`,
        subject: ligne.casNumber,
      })
    }
    if (ligne.ecNumber && !ligne.ecValid) {
      issues.push({
        code: 'invalid_ec_checksum',
        message: `Le numéro CE ${ligne.ecNumber} ne passe pas son contrôle de cohérence. Vérifiez-le sur la fiche.`,
        subject: ligne.ecNumber,
      })
    }
  }

  // Un code annoncé en rubrique 2 devrait se retrouver en rubrique 3.
  const codesComposition = new Set(input.rows.flatMap((ligne) => ligne.hazardStatements))
  if (codesComposition.size > 0) {
    for (const code of input.codesRubrique2) {
      if (!codesComposition.has(code)) {
        issues.push({
          code: 'code_absent_from_composition',
          message: `${code} figure dans la rubrique 2 mais n’apparaît sur aucune ligne de la composition. Vérifiez que rien ne manque.`,
          subject: code,
        })
      }
    }
  }

  if (input.rows.length === 0) {
    issues.push({
      code: 'composition_incomplete',
      message:
        'Aucune ligne de composition n’a pu être lue. La saisie manuelle est nécessaire pour cette fiche.',
    })
  }

  // Les rubriques indispensables à une analyse ultérieure.
  for (const numero of [1, 2, 3, 9, 16]) {
    if (input.segmentation.missing.includes(numero)) {
      issues.push({
        code: 'missing_section',
        message: `La rubrique ${numero} n’a pas été trouvée dans le document.`,
        subject: String(numero),
      })
    }
  }

  return issues
}
