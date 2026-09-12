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

export type RegulatorySource = {
  /** Identifiant stable, cité par les règles et les structures. */
  id: string
  jurisdiction: Jurisdiction
  title: string
  /** Référence officielle du document. */
  reference: string
  /** Version exactement consultée : date de consolidation ou de publication. */
  consultedVersion: string
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
    title: "Fiche d'information de l'Agence européenne des produits chimiques relative aux bougies",
    reference: 'Factsheet ECHA bougies, version française',
    consultedVersion: 'exemplaire fourni le 12 septembre 2026',
    localCopy: 'sources-reglementaires/Factsheet ECHA_bougie_fr_0.pdf',
    verifiedOn: '2026-09-12',
    verifiedBy: 'Jacques Pugin',
    notes:
      "Document d'information, pas un texte normatif : il ne peut fonder aucune règle du moteur, seulement éclairer une question.",
  },
} as const satisfies Record<string, RegulatorySource>

export type RegulatorySourceId = keyof typeof REGULATORY_SOURCES

export function getSource(id: RegulatorySourceId): RegulatorySource {
  return REGULATORY_SOURCES[id]
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
