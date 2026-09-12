/**
 * Référentiel des offres.
 *
 * Ces valeurs constituent le repli de référence : la base de données
 * (table `plans`) reste la source de vérité en production, afin de pouvoir
 * changer un tarif sans déployer. Les limites sont TOUJOURS vérifiées côté
 * serveur, jamais uniquement dans l'interface.
 */
export const PLAN_CODES = ['free', 'essential', 'pro', 'atelier'] as const
export type PlanCode = (typeof PLAN_CODES)[number]

export type PlanFeature =
  | 'sds_import'
  | 'regulatory_analysis'
  | 'labels'
  | 'history'
  | 'ufi'
  | 'document_archive'
  | 'exports'
  | 'assistant'
  | 'lots'
  | 'costing'
  | 'multi_user'

export type PlanDefinition = {
  code: PlanCode
  name: string
  tagline: string
  priceMonthlyCents: number
  priceYearlyCents: number
  currency: 'EUR'
  /** null = illimité */
  maxActiveProducts: number | null
  maxMembers: number
  maxStorageMb: number
  /** Extractions assistées par IA incluses par mois (0 = extraction algorithmique seule). */
  monthlyAiExtractions: number
  features: readonly PlanFeature[]
}

/** Deux mois offerts sur l'engagement annuel. */
function yearlyFromMonthly(monthlyCents: number): number {
  return monthlyCents * 10
}

export const PLANS: Record<PlanCode, PlanDefinition> = {
  free: {
    code: 'free',
    name: 'Gratuit',
    tagline: 'Pour tester réellement Normelya.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    currency: 'EUR',
    maxActiveProducts: 3,
    maxMembers: 1,
    maxStorageMb: 100,
    monthlyAiExtractions: 5,
    features: ['sds_import', 'regulatory_analysis', 'labels', 'history'],
  },
  essential: {
    code: 'essential',
    name: 'Essentiel',
    tagline: 'Pour une petite gamme de produits.',
    priceMonthlyCents: 990,
    priceYearlyCents: yearlyFromMonthly(990),
    currency: 'EUR',
    maxActiveProducts: 10,
    maxMembers: 1,
    maxStorageMb: 500,
    monthlyAiExtractions: 25,
    features: ['sds_import', 'regulatory_analysis', 'labels', 'history'],
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    tagline: 'Pour une marque qui se développe.',
    priceMonthlyCents: 1990,
    priceYearlyCents: yearlyFromMonthly(1990),
    currency: 'EUR',
    maxActiveProducts: null,
    maxMembers: 2,
    maxStorageMb: 2000,
    monthlyAiExtractions: 100,
    features: [
      'sds_import',
      'regulatory_analysis',
      'labels',
      'history',
      'ufi',
      'document_archive',
      'exports',
      'assistant',
    ],
  },
  atelier: {
    code: 'atelier',
    name: 'Atelier',
    tagline: 'Pour un atelier qui produit en lots.',
    priceMonthlyCents: 2990,
    priceYearlyCents: yearlyFromMonthly(2990),
    currency: 'EUR',
    maxActiveProducts: null,
    maxMembers: 5,
    maxStorageMb: 10000,
    monthlyAiExtractions: 250,
    features: [
      'sds_import',
      'regulatory_analysis',
      'labels',
      'history',
      'ufi',
      'document_archive',
      'exports',
      'assistant',
      'lots',
      'costing',
      'multi_user',
    ],
  },
}

export const PUBLIC_PLAN_ORDER: readonly PlanCode[] = ['free', 'essential', 'pro', 'atelier']

export function planHasFeature(plan: PlanCode, feature: PlanFeature): boolean {
  return PLANS[plan].features.includes(feature)
}

export type QuotaMetric = 'active_products' | 'members' | 'storage_bytes' | 'ai_extractions'

export type QuotaCheck =
  | { allowed: true; remaining: number | null }
  | { allowed: false; limit: number; current: number; message: string }

/**
 * Vérification d'un quota. Appelée côté serveur avant toute écriture concernée.
 */
export function checkQuota(plan: PlanCode, metric: QuotaMetric, current: number): QuotaCheck {
  const definition = PLANS[plan]
  const limit = quotaLimit(definition, metric)
  if (limit === null) return { allowed: true, remaining: null }
  if (current < limit) return { allowed: true, remaining: limit - current }
  return {
    allowed: false,
    limit,
    current,
    message: quotaMessage(definition, metric, limit),
  }
}

function quotaLimit(plan: PlanDefinition, metric: QuotaMetric): number | null {
  switch (metric) {
    case 'active_products':
      return plan.maxActiveProducts
    case 'members':
      return plan.maxMembers
    case 'storage_bytes':
      return plan.maxStorageMb * 1024 * 1024
    case 'ai_extractions':
      return plan.monthlyAiExtractions
  }
}

function quotaMessage(plan: PlanDefinition, metric: QuotaMetric, limit: number): string {
  switch (metric) {
    case 'active_products':
      return `Votre offre ${plan.name} permet ${limit} produit${limit > 1 ? 's' : ''} actif${limit > 1 ? 's' : ''}. Archivez un produit ou passez à une offre supérieure.`
    case 'members':
      return `Votre offre ${plan.name} permet ${limit} utilisateur${limit > 1 ? 's' : ''}.`
    case 'storage_bytes':
      return `Votre offre ${plan.name} inclut ${plan.maxStorageMb} Mo de documents.`
    case 'ai_extractions':
      return `Vous avez utilisé les ${limit} lectures assistées incluses ce mois-ci. La saisie manuelle reste disponible sans limite.`
  }
}
