/**
 * Statuts affichés à l'utilisateur.
 *
 * Un calcul réussi signifie que l'analyse est terminée, pas qu'un produit est
 * juridiquement en règle. Le vocabulaire proscrit par CLAUDE.md est listé plus
 * bas et vérifié automatiquement. Voir docs/01-produit.md § 1.7.
 */
export const NORMELYA_STATUSES = [
  'completed',
  'needs_verification',
  'action_required',
  'not_applicable',
] as const
export type NormelyaStatus = (typeof NORMELYA_STATUSES)[number]

export type StatusPresentation = {
  symbol: string
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}

export const STATUS_PRESENTATION: Record<NormelyaStatus, StatusPresentation> = {
  completed: { symbol: '✓', label: 'Analyse terminée', tone: 'success' },
  needs_verification: { symbol: '⚠', label: 'Vérification nécessaire', tone: 'warning' },
  action_required: { symbol: '●', label: 'Action requise', tone: 'danger' },
  not_applicable: { symbol: '○', label: 'Non applicable', tone: 'neutral' },
}

/**
 * État de calcul renvoyé par le moteur réglementaire.
 *
 * Distinct du statut d'affichage ci-dessus : celui-ci décrit ce que le moteur a
 * pu faire, celui-là ce que l'utilisateur doit faire.
 *
 *   complete         toutes les données nécessaires étaient présentes
 *   with_assumption  une hypothèse explicite a été appliquée, par exemple une
 *                    plage de concentration ramenée à sa borne haute
 *   review_required  une donnée bloquante manque, aucun résultat n'est produit
 */
export const COMPUTATION_STATES = ['complete', 'with_assumption', 'review_required'] as const
export type ComputationState = (typeof COMPUTATION_STATES)[number]

export const COMPUTATION_STATE_PRESENTATION: Record<
  ComputationState,
  { label: string; description: string; tone: 'success' | 'warning' | 'danger' }
> = {
  complete: {
    label: 'Calcul complet',
    description: 'Toutes les données nécessaires au calcul étaient présentes.',
    tone: 'success',
  },
  with_assumption: {
    label: 'Calcul avec hypothèse',
    description:
      'Une ou plusieurs hypothèses explicites ont été appliquées. Elles sont détaillées ci-dessous et enregistrées avec le résultat.',
    tone: 'warning',
  },
  review_required: {
    label: 'Vérification complémentaire nécessaire',
    description:
      'Une donnée indispensable manque ou n’est pas couverte. Aucun résultat n’est produit : Normelya ne devine pas.',
    tone: 'danger',
  },
}

/** Statut d'affichage correspondant à un état de calcul. */
export function statusForComputationState(state: ComputationState): NormelyaStatus {
  switch (state) {
    case 'complete':
      return 'completed'
    case 'with_assumption':
      return 'needs_verification'
    case 'review_required':
      return 'action_required'
  }
}

/**
 * Hypothèse appliquée par le moteur.
 *
 * Une hypothèse est toujours explicite, affichée à l'utilisateur et enregistrée
 * avec le calcul. Il n'existe aucune hypothèse implicite dans le moteur.
 */
export const ASSUMPTION_KINDS = [
  /** Plage de concentration déclarée en FDS, ramenée à la borne haute. */
  'concentration_upper_bound',
  /** Donnée absente, remplacée par la valeur la plus défavorable documentée. */
  'worst_case_substituted',
] as const
export type AssumptionKind = (typeof ASSUMPTION_KINDS)[number]

export type Assumption = {
  kind: AssumptionKind
  /** Substance, ingrédient ou champ concerné. */
  subject: string
  /** Ce que la source déclarait. */
  declared: string
  /** Ce que le moteur a retenu. */
  applied: string
  /** Explication en langage courant, destinée à l'utilisateur. */
  explanation: string
}

/**
 * Avertissement de proximité de seuil.
 *
 * Le moteur signale toute valeur calculée située à moins de 10 % sous un seuil
 * de bascule : l'utilisateur doit savoir qu'une petite variation de recette
 * changerait le résultat.
 */
export const THRESHOLD_PROXIMITY_RATIO = 0.1

export type ThresholdProximityWarning = {
  subject: string
  computedValue: number
  thresholdValue: number
  /** Écart relatif au seuil, entre 0 et THRESHOLD_PROXIMITY_RATIO. */
  relativeGap: number
  ruleId: string
}

/**
 * Détermine si une valeur calculée est assez proche d'un seuil pour mériter un
 * avertissement. La valeur doit rester STRICTEMENT sous le seuil : au-dessus,
 * le seuil est franchi et ce n'est plus un avertissement mais un résultat.
 */
export function isNearThreshold(computedValue: number, thresholdValue: number): boolean {
  if (!Number.isFinite(computedValue) || !Number.isFinite(thresholdValue)) return false
  if (thresholdValue <= 0) return false
  if (computedValue >= thresholdValue) return false
  const gap = (thresholdValue - computedValue) / thresholdValue
  return gap <= THRESHOLD_PROXIMITY_RATIO
}

/**
 * Vocabulaire interdit.
 *
 * Ces termes ne doivent apparaître nulle part : interface, PDF généré, page
 * publique. Un contrôle automatisé (scripts/verifier-vocabulaire.mjs) échoue le
 * build si l'un d'eux se glisse dans un texte destiné à l'utilisateur.
 *
 * Le substantif « conformité » reste autorisé : il nomme un domaine
 * (« centre de conformité »), il n'affirme rien sur un produit.
 */
/**
 * Les limites de mot de JavaScript (\b) ignorent les lettres accentuées.
 * On encadre donc chaque terme par des lookarounds Unicode.
 */
const LETTRE = '[\\p{L}\\p{M}]'

function motInterdit(motif: string): RegExp {
  return new RegExp(`(?<!${LETTRE})(?:${motif})(?!${LETTRE})`, 'iu')
}

// vocabulaire-autorise-debut: ces termes sont cités ici pour être interdits.
export const FORBIDDEN_RESULT_PATTERNS: readonly RegExp[] = [
  motInterdit('conformes?'),
  /conformité\s+garantie/iu,
  motInterdit('certifiée?s?'),
  motInterdit('homologuée?s?'),
]
// vocabulaire-autorise-fin

export type ForbiddenWordFinding = { pattern: string; excerpt: string }

/** Recherche du vocabulaire interdit dans un texte destiné à l'utilisateur. */
export function findForbiddenWords(text: string): ForbiddenWordFinding[] {
  const trouvailles: ForbiddenWordFinding[] = []
  for (const pattern of FORBIDDEN_RESULT_PATTERNS) {
    const correspondance = new RegExp(pattern.source, pattern.flags).exec(text)
    if (correspondance) {
      trouvailles.push({ pattern: pattern.source, excerpt: correspondance[0] })
    }
  }
  return trouvailles
}

/** Formulations de remplacement, à employer partout. */
export const APPROVED_RESULT_PHRASES = {
  analysisDone: 'Analyse terminée',
  computedUnderClp: 'Calcul effectué selon le règlement (CE) n° 1272/2008',
  toVerify: 'À vérifier',
} as const
