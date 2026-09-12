/**
 * Registre des sources réglementaires.
 *
 * Toute règle, toute constante, toute structure documentaire employée par
 * Normelya doit référencer une entrée de ce registre. Une entrée décrit un
 * texte officiel, la version exactement consultée, et qui l'a vérifiée.
 *
 * Règle de construction, vérifiée par test : aucune source n'est déclarée sans
 * `verifiedOn` et `verifiedBy`. Une source vérifiée depuis plus de douze mois
 * déclenche un avertissement, car un texte consolidé évolue.
 */

export type Jurisdiction = 'EU' | 'FR' | 'CH'

/**
 * Statut d'une source. Guides et brochures pour comprendre, textes consolidés
 * pour les valeurs.
 *
 *   normative    Texte consolidé. SEULE source dont on extrait une valeur
 *                réglementaire : seuil, mention, pictogramme, classification,
 *                structure documentaire.
 *
 *   explanatory  Guide, brochure, fiche d'information, note d'agence. Sert
 *                uniquement à comprendre : repérer une question, éclairer une
 *                notion, orienter une recherche. On n'en extrait AUCUNE valeur,
 *                même si elle y figure noir sur blanc.
 *
 * Ces documents explicatifs sont fréquemment antérieurs à la dernière
 * consolidation du texte qu'ils commentent. En cas de divergence, le texte
 * consolidé prime, et la divergence doit être signalée.
 */
export type SourceStatus = 'normative' | 'explanatory'

export type RegulatorySource = {
  /** Identifiant stable, cité par les règles et les structures. */
  id: string
  jurisdiction: Jurisdiction
  status: SourceStatus
  title: string
  /** Référence officielle du document. */
  reference: string
  /** Version exactement consultée : date de consolidation ou de publication. */
  consultedVersion: string
  /**
   * Date de publication du document, au format ISO abrégé.
   * Renseignée pour les documents explicatifs, afin de rendre visible leur
   * antériorité éventuelle sur le texte qu'ils commentent.
   */
  publishedOn?: string
  /** Copie locale employée pour la lecture, hors dépôt public si nécessaire. */
  localCopy?: string
  url?: string
  /** Date de vérification humaine, au format ISO. */
  verifiedOn: string
  /** Personne ayant ouvert le texte et vérifié ce qui en est tiré. */
  verifiedBy: string
  notes?: string
}

export const REGULATORY_SOURCES = {
  EU_REACH_1907_2006: {
    id: 'EU_REACH_1907_2006',
    jurisdiction: 'EU',
    status: 'normative',
    title:
      "Règlement (CE) n° 1907/2006 concernant l'enregistrement, l'évaluation et l'autorisation des substances chimiques, ainsi que les restrictions applicables à ces substances (REACH)",
    reference: 'CELEX 02006R1907',
    consultedVersion: 'version consolidée du 22 juin 2026',
    localCopy: 'sources-reglementaires/CELEX_02006R1907-20260622_FR_TXT.pdf',
    verifiedOn: '2026-09-12',
    verifiedBy: 'Jacques Pugin',
    notes:
      "L'annexe II, telle que remplacée par le règlement (UE) 2020/878, définit la structure de la fiche de données de sécurité.",
  },
  EU_CLP_1272_2008: {
    id: 'EU_CLP_1272_2008',
    jurisdiction: 'EU',
    status: 'normative',
    title:
      "Règlement (CE) n° 1272/2008 relatif à la classification, à l'étiquetage et à l'emballage des substances et des mélanges",
    reference: 'CELEX 02008R1272',
    consultedVersion: 'version consolidée du 1er juillet 2026',
    localCopy: 'sources-reglementaires/CELEX_02008R1272-20260701_FR_TXT.pdf',
    verifiedOn: '2026-09-12',
    verifiedBy: 'Jacques Pugin',
    notes:
      "Aucune règle de classification n'est encore tirée de ce texte : la phase 5 n'est pas ouverte.",
  },
  CH_ORDONNANCE_2015_366: {
    id: 'CH_ORDONNANCE_2015_366',
    jurisdiction: 'CH',
    status: 'normative',
    title: 'Ordonnance suisse publiée au recueil systématique, référence eli/cc/2015/366',
    reference: 'eli/cc/2015/366',
    consultedVersion: 'état au 24 avril 2026',
    localCopy: 'sources-reglementaires/fedlex-data-admin-ch-eli-cc-2015-366-20260424-fr-pdf-a.pdf',
    verifiedOn: '2026-09-12',
    verifiedBy: 'Jacques Pugin',
    notes:
      "Texte fourni pour le marché suisse. Son périmètre exact reste à établir avant toute règle : voir docs/08-validation-humaine.md.",
  },
  ECHA_FICHE_BOUGIES: {
    id: 'ECHA_FICHE_BOUGIES',
    jurisdiction: 'EU',
    status: 'explanatory',
    title: "Fiche d'information de l'Agence européenne des produits chimiques relative aux bougies",
    reference: 'Factsheet ECHA bougies, version française',
    consultedVersion: "exemplaire d'août 2024, fourni le 12 septembre 2026",
    publishedOn: '2024-08',
    localCopy: 'sources-reglementaires/Factsheet ECHA_bougie_fr_0.pdf',
    verifiedOn: '2026-09-12',
    verifiedBy: 'Jacques Pugin',
    notes:
      "COMPRÉHENSION SEULEMENT. Ce document d'août 2024 est antérieur au règlement CLP consolidé au 1er juillet 2026 et au règlement REACH consolidé au 22 juin 2026. Aucune valeur réglementaire n'en est extraite. En cas de divergence avec un texte consolidé, le texte consolidé prime et la divergence doit être signalée.",
  },
} as const satisfies Record<string, RegulatorySource>

export type RegulatorySourceId = keyof typeof REGULATORY_SOURCES

export function getSource(id: RegulatorySourceId): RegulatorySource {
  return REGULATORY_SOURCES[id]
}

export class ExplanatorySourceMisuse extends Error {
  constructor(source: RegulatorySource) {
    super(
      `« ${source.title} » est une source de compréhension, pas un texte consolidé. ` +
        "Aucune valeur réglementaire ne peut en être tirée. Voir CLAUDE.md, hiérarchie des sources.",
    )
    this.name = 'ExplanatorySourceMisuse'
  }
}

/**
 * Garde-fou d'exécution.
 *
 * À appeler avant de tirer une valeur réglementaire d'une source. Un guide ou
 * une brochure lève ici, même si la valeur cherchée y figure noir sur blanc :
 * ces documents commentent un texte, ils ne le remplacent pas, et sont
 * fréquemment antérieurs à sa dernière consolidation.
 */
export function assertNormative(id: RegulatorySourceId): RegulatorySource {
  const source = REGULATORY_SOURCES[id]
  if (source.status !== 'normative') throw new ExplanatorySourceMisuse(source)
  return source
}

export function normativeSources(): RegulatorySource[] {
  return Object.values(REGULATORY_SOURCES).filter((source) => source.status === 'normative')
}

export function explanatorySources(): RegulatorySource[] {
  return Object.values(REGULATORY_SOURCES).filter((source) => source.status === 'explanatory')
}

/** Durée au-delà de laquelle une vérification doit être refaite. */
export const VERIFICATION_VALIDITY_MONTHS = 12

/**
 * Sources dont la vérification est trop ancienne à la date donnée.
 * La date est un paramètre : cette fonction reste déterministe et testable.
 */
export function staleSources(evaluatedAt: string): RegulatorySource[] {
  const limite = new Date(evaluatedAt)
  if (Number.isNaN(limite.getTime())) {
    throw new Error(`Date d'évaluation invalide : ${evaluatedAt}`)
  }
  limite.setMonth(limite.getMonth() - VERIFICATION_VALIDITY_MONTHS)

  return Object.values(REGULATORY_SOURCES).filter(
    (source) => new Date(source.verifiedOn) < limite,
  )
}
