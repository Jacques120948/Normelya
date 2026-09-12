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
  | 'product_sds'
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
  /**
   * Nombre de produits actifs simultanément. null = illimité.
   */
  maxActiveProducts: number | null
  /**
   * Nombre total de produits créables sur la durée de vie du compte.
   * null = pas de plafond cumulatif.
   *
   * L'offre gratuite utilise ce plafond : ses 3 produits ne sont PAS
   * renouvelables, archiver un produit ne libère pas de place.
   */
  maxLifetimeProducts: number | null
  maxMembers: number
  maxStorageMb: number
  /** Extractions de FDS fournisseur assistées par IA, incluses par mois. */
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
    tagline: 'Trois produits documentés, pour évaluer réellement Normelya.',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    currency: 'EUR',
    maxActiveProducts: 3,
    maxLifetimeProducts: 3,
    maxMembers: 1,
    maxStorageMb: 100,
    monthlyAiExtractions: 5,
    features: ['sds_import', 'regulatory_analysis', 'labels', 'history'],
  },
  essential: {
    code: 'essential',
    name: 'Essentiel',
    tagline: 'Pour une petite gamme de produits.',
    priceMonthlyCents: 900,
    priceYearlyCents: yearlyFromMonthly(900),
    currency: 'EUR',
    maxActiveProducts: 15,
    maxLifetimeProducts: null,
    maxMembers: 1,
    maxStorageMb: 500,
    monthlyAiExtractions: 25,
    features: ['sds_import', 'regulatory_analysis', 'labels', 'history'],
  },
  pro: {
    code: 'pro',
    name: 'Pro',
    tagline: 'Produits illimités, avec la FDS du produit dilué et l’UFI.',
    priceMonthlyCents: 1500,
    priceYearlyCents: yearlyFromMonthly(1500),
    currency: 'EUR',
    maxActiveProducts: null,
    maxLifetimeProducts: null,
    maxMembers: 2,
    maxStorageMb: 2000,
    monthlyAiExtractions: 100,
    features: [
      'sds_import',
      'regulatory_analysis',
      'labels',
      'product_sds',
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
    tagline: 'Tout Pro, plus les lots, la traçabilité et les coûts.',
    priceMonthlyCents: 2500,
    priceYearlyCents: yearlyFromMonthly(2500),
    currency: 'EUR',
    maxActiveProducts: null,
    maxLifetimeProducts: null,
    maxMembers: 5,
    maxStorageMb: 10000,
    monthlyAiExtractions: 250,
    features: [
      'sds_import',
      'regulatory_analysis',
      'labels',
      'product_sds',
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

export type QuotaMetric =
  | 'active_products'
  /** Produits créés depuis l'ouverture du compte. Ne décroît jamais. */
  | 'lifetime_products'
  | 'members'
  | 'storage_bytes'
  | 'ai_extractions'

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

/**
 * Quotas à vérifier avant de créer un produit.
 *
 * Sur l'offre gratuite, les deux plafonds s'appliquent : le nombre de produits
 * actifs et le nombre total de produits jamais créés.
 */
export function productCreationMetrics(plan: PlanCode): QuotaMetric[] {
  const metrics: QuotaMetric[] = ['active_products']
  if (PLANS[plan].maxLifetimeProducts !== null) metrics.push('lifetime_products')
  return metrics
}

function quotaLimit(plan: PlanDefinition, metric: QuotaMetric): number | null {
  switch (metric) {
    case 'active_products':
      return plan.maxActiveProducts
    case 'lifetime_products':
      return plan.maxLifetimeProducts
    case 'members':
      return plan.maxMembers
    case 'storage_bytes':
      return plan.maxStorageMb * 1024 * 1024
    case 'ai_extractions':
      return plan.monthlyAiExtractions
  }
}

function quotaMessage(plan: PlanDefinition, metric: QuotaMetric, limit: number): string {
  const pluriel = limit > 1 ? 's' : ''
  switch (metric) {
    case 'active_products':
      return `Votre offre ${plan.name} permet ${limit} produit${pluriel} actif${pluriel}. Archivez un produit ou passez à une offre supérieure.`
    case 'lifetime_products':
      return `L’offre ${plan.name} permet de documenter ${limit} produit${pluriel} au total. Ce quota n’est pas renouvelable : passez à une offre supérieure pour en créer d’autres.`
    case 'members':
      return `Votre offre ${plan.name} permet ${limit} utilisateur${pluriel}.`
    case 'storage_bytes':
      return `Votre offre ${plan.name} inclut ${plan.maxStorageMb} Mo de documents.`
    case 'ai_extractions':
      return `Vous avez utilisé les ${limit} lectures assistées incluses ce mois-ci. La saisie manuelle reste disponible sans limite.`
  }
}
