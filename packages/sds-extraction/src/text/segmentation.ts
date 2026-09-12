/**
 * Découpage d'une fiche de données de sécurité en rubriques.
 *
 * La segmentation repose sur le NUMÉRO de rubrique, jamais sur son intitulé.
 * C'est un choix délibéré :
 *
 *   · les intitulés varient d'un fournisseur et d'une langue à l'autre ;
 *   · surtout, les intitulés officiels sont du contenu réglementaire. Les coder
 *     en dur reviendrait à écrire une constante réglementaire sans source, ce
 *     que CLAUDE.md interdit.
 *
 * Le module relève donc l'intitulé TEL QU'IL EST ÉCRIT dans le document, sans
 * le comparer à une référence. Une fiche numérotée de 1 à 16 est segmentée
 * correctement quelle que soit la formulation employée.
 */

export const SDS_SECTION_COUNT = 16

/** Mots introduisant une rubrique, dans les langues couvertes par le corpus. */
const MOTS_DE_RUBRIQUE = ['rubrique', 'section', 'abschnitt', 'sezione', 'sectie'] as const

const EN_TETE_AVEC_MOT = new RegExp(
  `^\\s*(?:${MOTS_DE_RUBRIQUE.join('|')})\\s*[:.\\-–]?\\s*(\\d{1,2})\\b\\s*[:.\\-–]?\\s*(.*)$`,
  'i',
)

/** En-tête sans mot introducteur : « 3. Composition… ». */
const EN_TETE_NUMERIQUE = /^\s*(\d{1,2})\s*[.)]\s+(\S.*)$/

export type SdsSection = {
  /** Numéro de rubrique, de 1 à 16. */
  number: number
  /** Intitulé relevé dans le document, sans interprétation. */
  heading: string
  /** Corps de la rubrique, en-tête exclu. */
  body: string
  /** Index de la ligne d'en-tête dans le document. */
  startLine: number
  endLine: number
}

export type SegmentationResult = {
  sections: Map<number, SdsSection>
  /** Numéros de rubriques attendus mais introuvables. */
  missing: number[]
  /** Part des seize rubriques effectivement repérées, entre 0 et 1. */
  coverage: number
  /** Langue devinée d'après le mot introducteur dominant, ou null. */
  detectedLanguageHint: string | null
}

type EnTete = { number: number; heading: string; line: number; mot: string | null }

/**
 * Segmente un document en rubriques.
 *
 * Robustesse recherchée : un fournisseur qui écrit « SECTION 3 » et un autre
 * « 3. COMPOSITION » doivent produire le même découpage.
 */
export function segmentSections(texte: string): SegmentationResult {
  const lignes = texte.split(/\r?\n/)
  const enTetes = releverEnTetes(lignes)
  const sections = new Map<number, SdsSection>()

  enTetes.forEach((enTete, index) => {
    const suivant = enTetes[index + 1]
    const finLigne = suivant ? suivant.line - 1 : lignes.length - 1
    const corps = lignes.slice(enTete.line + 1, finLigne + 1).join('\n').trim()

    // Une rubrique répétée (rappel en pied de page, sommaire) ne remplace pas
    // la première occurrence si celle-ci porte déjà du contenu.
    const existante = sections.get(enTete.number)
    if (existante && existante.body.length >= corps.length) return

    sections.set(enTete.number, {
      number: enTete.number,
      heading: enTete.heading.trim(),
      body: corps,
      startLine: enTete.line,
      endLine: finLigne,
    })
  })

  const missing: number[] = []
  for (let numero = 1; numero <= SDS_SECTION_COUNT; numero += 1) {
    if (!sections.has(numero)) missing.push(numero)
  }

  return {
    sections,
    missing,
    coverage: (SDS_SECTION_COUNT - missing.length) / SDS_SECTION_COUNT,
    detectedLanguageHint: devinerLangue(enTetes),
  }
}

function releverEnTetes(lignes: string[]): EnTete[] {
  const enTetes: EnTete[] = []

  lignes.forEach((ligne, index) => {
    const avecMot = EN_TETE_AVEC_MOT.exec(ligne)
    if (avecMot) {
      const numero = Number(avecMot[1])
      if (estNumeroDeRubrique(numero)) {
        const mot = ligne.trim().split(/[\s:.\-–]/)[0]?.toLowerCase() ?? null
        enTetes.push({ number: numero, heading: avecMot[2] ?? '', line: index, mot })
      }
      return
    }

    const numerique = EN_TETE_NUMERIQUE.exec(ligne)
    if (numerique) {
      const numero = Number(numerique[1])
      const intitule = numerique[2] ?? ''
      // Un en-tête sans mot introducteur n'est retenu que s'il ressemble à un
      // titre : court, et non terminé par une ponctuation de phrase.
      if (estNumeroDeRubrique(numero) && intitule.length <= 120 && !/[.;,]$/.test(intitule)) {
        enTetes.push({ number: numero, heading: intitule, line: index, mot: null })
      }
    }
  })

  return enTetes.sort((a, b) => a.line - b.line)
}

function estNumeroDeRubrique(numero: number): boolean {
  return Number.isInteger(numero) && numero >= 1 && numero <= SDS_SECTION_COUNT
}

function devinerLangue(enTetes: EnTete[]): string | null {
  const comptes = new Map<string, number>()
  for (const enTete of enTetes) {
    if (!enTete.mot) continue
    comptes.set(enTete.mot, (comptes.get(enTete.mot) ?? 0) + 1)
  }
  if (comptes.size === 0) return null

  const dominant = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  switch (dominant) {
    case 'rubrique':
      return 'fr'
    case 'abschnitt':
      return 'de'
    case 'sezione':
      return 'it'
    case 'sectie':
      return 'nl'
    case 'section':
      // « SECTION » s'emploie en français comme en anglais : indécidable ici.
      return null
    default:
      return null
  }
}

/* ------------------------------------------------------------ Sous-rubriques */

export type SdsSubsection = {
  /** Référence telle qu'écrite : « 3.2 ». */
  reference: string
  heading: string
  body: string
}

const SOUS_RUBRIQUE = /^\s*(\d{1,2}\.\d{1,2})\s*[:.\-–)]?\s*(.*)$/

/**
 * Découpe une rubrique en sous-rubriques numérotées.
 * Seules les références dont le premier nombre correspond à la rubrique sont
 * retenues : « 3.2 » dans la rubrique 3, jamais « 9.1 ».
 */
export function segmentSubsections(section: SdsSection): SdsSubsection[] {
  const lignes = section.body.split(/\r?\n/)
  const debuts: Array<{ reference: string; heading: string; line: number }> = []

  lignes.forEach((ligne, index) => {
    const correspondance = SOUS_RUBRIQUE.exec(ligne)
    if (!correspondance) return
    const reference = correspondance[1]!
    if (Number(reference.split('.')[0]) !== section.number) return
    debuts.push({ reference, heading: (correspondance[2] ?? '').trim(), line: index })
  })

  return debuts.map((debut, index) => {
    const suivant = debuts[index + 1]
    const fin = suivant ? suivant.line : lignes.length
    return {
      reference: debut.reference,
      heading: debut.heading,
      body: lignes.slice(debut.line + 1, fin).join('\n').trim(),
    }
  })
}
