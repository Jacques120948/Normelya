/**
 * Statuts affichés à l'utilisateur.
 *
 * Normelya n'emploie jamais le mot « conforme » comme résultat d'un calcul :
 * un calcul réussi signifie que l'analyse est terminée, pas qu'un produit est
 * juridiquement conforme. Voir docs/01-produit.md § 1.7.
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

/** Mots interdits dans toute chaîne présentée comme un résultat de calcul. */
export const FORBIDDEN_RESULT_WORDS = ['conforme', 'conformité garantie', 'certifié'] as const
