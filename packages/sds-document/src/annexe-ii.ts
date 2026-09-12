import { getSource, type RegulatorySourceId } from '@normelya/regulatory-sources'

/**
 * Structure de la fiche de données de sécurité.
 *
 * SOURCE      Règlement (CE) n° 1907/2006 (REACH), annexe II, partie B,
 *             telle que remplacée par le règlement (UE) 2020/878.
 * RÉFÉRENCE   Annexe II, partie B : « La fiche de données de sécurité doit
 *             comprendre les 16 rubriques suivantes, conformément à
 *             l'article 31, paragraphe 6, ainsi que les sous-rubriques
 *             mentionnées ci-après, excepté pour la rubrique 3, dans laquelle
 *             seule la sous-rubrique 3.1 ou la sous-rubrique 3.2 doit être
 *             intégrée selon le cas. »
 * VERSION     Texte consolidé du 22 juin 2026, exemplaire conservé dans
 *             sources-reglementaires/.
 * VÉRIFIÉ LE  2026-09-12
 *
 * PORTÉE DE CE FICHIER — à lire avant toute modification.
 *
 * Il décrit UNIQUEMENT la structure : la numérotation des rubriques, leurs
 * intitulés officiels, et les sous-rubriques attendues. Ce sont des données
 * relevées dans le texte, pas des règles déduites.
 *
 * Il ne dit RIEN de ce qu'il faut écrire dans chaque rubrique. Les règles de
 * contenu — que faut-il déclarer, à partir de quel seuil, sous quelle forme —
 * relèvent du moteur réglementaire et restent soumises à validation humaine
 * préalable. Aucune ne doit être ajoutée ici.
 */

export const ANNEX_II_SOURCE: RegulatorySourceId = 'EU_REACH_1907_2006'
export const ANNEX_II_REFERENCE = 'Annexe II, partie B'
export const ANNEX_II_VERIFIED_ON = '2026-09-12'

export type SdsSubsectionDefinition = {
  /** Référence officielle, telle qu'écrite : « 1.1 ». */
  reference: string
  /** Intitulé officiel, relevé dans le texte. */
  title: string
}

export type SdsSectionDefinition = {
  number: number
  title: string
  subsections: readonly SdsSubsectionDefinition[]
  /**
   * Note de structure, lorsque le texte prévoit une particularité.
   * Jamais une règle de contenu.
   */
  structuralNote?: string
}

export const SDS_SECTIONS: readonly SdsSectionDefinition[] = [
  {
    number: 1,
    title: "Identification de la substance/du mélange et de la société/de l'entreprise",
    subsections: [
      { reference: '1.1', title: 'Identificateur de produit' },
      {
        reference: '1.2',
        title:
          'Utilisations identifiées pertinentes de la substance ou du mélange et utilisations déconseillées',
      },
      {
        reference: '1.3',
        title: 'Renseignements concernant le fournisseur de la fiche de données de sécurité',
      },
      { reference: '1.4', title: "Numéro d'appel d'urgence" },
    ],
  },
  {
    number: 2,
    title: 'Identification des dangers',
    subsections: [
      { reference: '2.1', title: 'Classification de la substance ou du mélange' },
      { reference: '2.2', title: "Éléments d'étiquetage" },
      { reference: '2.3', title: 'Autres dangers' },
    ],
  },
  {
    number: 3,
    title: 'Composition/informations sur les composants',
    subsections: [
      { reference: '3.1', title: 'Substances' },
      { reference: '3.2', title: 'Mélanges' },
    ],
    structuralNote:
      "Le texte prévoit qu'une seule des deux sous-rubriques soit intégrée, selon que la fiche porte sur une substance ou sur un mélange.",
  },
  {
    number: 4,
    title: 'Premiers secours',
    subsections: [
      { reference: '4.1', title: 'Description des mesures de premiers secours' },
      { reference: '4.2', title: 'Principaux symptômes et effets, aigus et différés' },
      {
        reference: '4.3',
        title:
          'Indication des éventuels soins médicaux immédiats et traitements particuliers nécessaires',
      },
    ],
  },
  {
    number: 5,
    title: "Mesures de lutte contre l'incendie",
    subsections: [
      { reference: '5.1', title: "Moyens d'extinction" },
      { reference: '5.2', title: 'Dangers particuliers résultant de la substance ou du mélange' },
      { reference: '5.3', title: 'Conseils aux pompiers' },
    ],
  },
  {
    number: 6,
    title: 'Mesures à prendre en cas de dispersion accidentelle',
    subsections: [
      {
        reference: '6.1',
        title: "Précautions individuelles, équipement de protection et procédures d'urgence",
      },
      { reference: '6.2', title: "Précautions pour la protection de l'environnement" },
      { reference: '6.3', title: 'Méthodes et matériel de confinement et de nettoyage' },
      { reference: '6.4', title: "Référence à d'autres rubriques" },
    ],
  },
  {
    number: 7,
    title: 'Manipulation et stockage',
    subsections: [
      { reference: '7.1', title: 'Précautions à prendre pour une manipulation sans danger' },
      {
        reference: '7.2',
        title: "Conditions d'un stockage sûr, y compris les éventuelles incompatibilités",
      },
      { reference: '7.3', title: 'Utilisation(s) finale(s) particulière(s)' },
    ],
  },
  {
    number: 8,
    title: "Contrôles de l'exposition/protection individuelle",
    subsections: [
      { reference: '8.1', title: 'Paramètres de contrôle' },
      { reference: '8.2', title: "Contrôles de l'exposition" },
    ],
  },
  {
    number: 9,
    title: 'Propriétés physiques et chimiques',
    subsections: [
      {
        reference: '9.1',
        title: 'Informations sur les propriétés physiques et chimiques essentielles',
      },
      { reference: '9.2', title: 'Autres informations' },
    ],
  },
  {
    number: 10,
    title: 'Stabilité et réactivité',
    subsections: [
      { reference: '10.1', title: 'Réactivité' },
      { reference: '10.2', title: 'Stabilité chimique' },
      { reference: '10.3', title: 'Possibilité de réactions dangereuses' },
      { reference: '10.4', title: 'Conditions à éviter' },
      { reference: '10.5', title: 'Matières incompatibles' },
      { reference: '10.6', title: 'Produits de décomposition dangereux' },
    ],
  },
  {
    number: 11,
    title: 'Informations toxicologiques',
    subsections: [
      {
        reference: '11.1',
        title:
          'Informations sur les classes de danger telles que définies dans le règlement (CE) n° 1272/2008',
      },
      { reference: '11.2', title: 'Informations sur les autres dangers' },
    ],
  },
  {
    number: 12,
    title: 'Informations écologiques',
    subsections: [
      { reference: '12.1', title: 'Toxicité' },
      { reference: '12.2', title: 'Persistance et dégradabilité' },
      { reference: '12.3', title: 'Potentiel de bioaccumulation' },
      { reference: '12.4', title: 'Mobilité dans le sol' },
      { reference: '12.5', title: 'Résultats des évaluations PBT et vPvB' },
      { reference: '12.6', title: 'Propriétés perturbant le système endocrinien' },
      { reference: '12.7', title: 'Autres effets néfastes' },
    ],
  },
  {
    number: 13,
    title: "Considérations relatives à l'élimination",
    subsections: [{ reference: '13.1', title: 'Méthodes de traitement des déchets' }],
  },
  {
    number: 14,
    title: 'Informations relatives au transport',
    subsections: [
      { reference: '14.1', title: "Numéro ONU ou numéro d'identification" },
      { reference: '14.2', title: "Désignation officielle de transport de l'ONU" },
      { reference: '14.3', title: 'Classe(s) de danger pour le transport' },
      { reference: '14.4', title: "Groupe d'emballage" },
      { reference: '14.5', title: "Dangers pour l'environnement" },
      { reference: '14.6', title: "Précautions particulières à prendre par l'utilisateur" },
      {
        reference: '14.7',
        title: "Transport maritime en vrac conformément aux instruments de l'OMI",
      },
    ],
  },
  {
    number: 15,
    title: 'Informations relatives à la réglementation',
    subsections: [
      {
        reference: '15.1',
        title:
          "Réglementations/législation particulières à la substance ou au mélange en matière de sécurité, de santé et d'environnement",
      },
      { reference: '15.2', title: 'Évaluation de la sécurité chimique' },
    ],
  },
  {
    number: 16,
    title: 'Autres informations',
    subsections: [],
  },
]

export const SDS_SECTION_COUNT = 16

export function findSection(number: number): SdsSectionDefinition | null {
  return SDS_SECTIONS.find((section) => section.number === number) ?? null
}

export function findSubsection(reference: string): SdsSubsectionDefinition | null {
  for (const section of SDS_SECTIONS) {
    const trouvee = section.subsections.find((sous) => sous.reference === reference)
    if (trouvee) return trouvee
  }
  return null
}

/** Provenance de la structure, à faire figurer sur tout document produit. */
export function structureProvenance(): {
  sourceTitle: string
  reference: string
  consultedVersion: string
  verifiedOn: string
} {
  const source = getSource(ANNEX_II_SOURCE)
  return {
    sourceTitle: source.title,
    reference: ANNEX_II_REFERENCE,
    consultedVersion: source.consultedVersion,
    verifiedOn: ANNEX_II_VERIFIED_ON,
  }
}
