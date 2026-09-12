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

import { normalizeTypography } from './normalize'

export const SDS_SECTION_COUNT = 16

/** Mots introduisant une rubrique, dans les langues couvertes par le corpus. */
const MOTS_DE_RUBRIQUE = ['rubrique', 'section', 'abschnitt', 'sezione', 'sectie'] as const

const EN_TETE_AVEC_MOT = new RegExp(
  `^\\s*(?:${MOTS_DE_RUBRIQUE.join('|')})\\s*[:.\\-–]?\\s*(\\d{1,2})\\b\\s*[:.\\-–]?\\s*(.*)$`,
  'i',
)

/** En-tête sans mot introducteur : « 3. Composition… ». */
const EN_TETE_NUMERIQUE = /^\s*(\d{1,2})\s*[.)]\s+(\S.*)$/

/**
 * En-tête sans ponctuation : « 3 Composition/informations sur les composants ».
 *
 * Cette forme est ambiguë — « 3 produits sont concernés » lui ressemble. Elle
 * n'est donc retenue qu'en seconde passe, si la lecture stricte a échoué, et
 * seulement lorsqu'elle fait apparaître nettement plus de rubriques.
 */
const EN_TETE_SANS_PONCTUATION = /^\s*(\d{1,2})\s+([A-ZÀ-Ý]\S.{2,95})$/

/** Mot introducteur seul sur sa ligne, le numéro étant reporté à la suivante. */
const MOT_INTRODUCTEUR_SEUL = new RegExp(`^\\s*(?:${MOTS_DE_RUBRIQUE.join('|')})\\s*$`, 'i')

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
export function segmentSections(texteBrut: string): SegmentationResult {
  // Les tirets cadratin et demi-cadratin, les espaces insécables et les
  // apostrophes courbes sont ramenés à leur forme saisissable. Le texte
  // officiel du règlement écrit « RUBRIQUE 1 — Identification » : sans cette
  // étape, aucun en-tête n'est reconnu.
  const lignes = normalizeTypography(texteBrut).split(/\r?\n/)

  // Première passe, stricte. Si elle ne retrouve pas la moitié des rubriques,
  // le document emploie sans doute une mise en page moins conventionnelle : on
  // retente avec des règles tolérantes, et on ne les garde que si elles font
  // mieux. Un document bien formé n'est jamais soumis aux règles permissives.
  let enTetes = releverEnTetes(lignes, { tolerant: false })
  if (compterRubriques(enTetes) < SDS_SECTION_COUNT / 2) {
    const tolerants = releverEnTetes(lignes, { tolerant: true })
    if (compterRubriques(tolerants) > compterRubriques(enTetes)) {
      enTetes = tolerants
    }
  }
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

function compterRubriques(enTetes: EnTete[]): number {
  return new Set(enTetes.map((enTete) => enTete.number)).size
}

function releverEnTetes(lignes: string[], options: { tolerant: boolean }): EnTete[] {
  const enTetes: EnTete[] = []

  lignes.forEach((ligne, index) => {
    // « section » seul sur sa ligne, « 1 Identification… » sur la suivante :
    // mise en page rencontrée sur des fiches réelles.
    if (options.tolerant && MOT_INTRODUCTEUR_SEUL.test(ligne)) {
      const suivante = lignes[index + 1] ?? ''
      const reporte = /^\s*(\d{1,2})\s*[:.\-–)]?\s*(.*)$/.exec(suivante)
      if (reporte) {
        const numero = Number(reporte[1])
        if (estNumeroDeRubrique(numero)) {
          enTetes.push({
            number: numero,
            heading: reporte[2] ?? '',
            line: index + 1,
            mot: ligne.trim().toLowerCase(),
          })
          return
        }
      }
    }

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
      return
    }

    if (options.tolerant) {
      const sansPonctuation = EN_TETE_SANS_PONCTUATION.exec(ligne)
      if (sansPonctuation) {
        const numero = Number(sansPonctuation[1])
        const intitule = sansPonctuation[2] ?? ''
        if (estNumeroDeRubrique(numero) && !/[.;,]$/.test(intitule)) {
          enTetes.push({ number: numero, heading: intitule, line: index, mot: null })
        }
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
