/** Marchés couverts par la V1. L'ajout d'un marché est un travail réglementaire. */
export const MARKETS = ['FR', 'CH'] as const
export type Market = (typeof MARKETS)[number]

/** Marchés dont l'architecture est prête mais les règles non écrites. */
export const PLANNED_MARKETS = ['BE', 'DE', 'IT'] as const

export const MARKET_LABELS: Record<Market, string> = {
  FR: 'France',
  CH: 'Suisse',
}

export const PRODUCT_TYPES = ['candle', 'wax_melt'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  candle: 'Bougie',
  wax_melt: 'Fondant parfumé',
}

export const RAW_MATERIAL_CATEGORIES = [
  'fragrance',
  'wax',
  'dye',
  'additive',
  'wick',
  'other',
] as const
export type RawMaterialCategory = (typeof RAW_MATERIAL_CATEGORIES)[number]

export const RAW_MATERIAL_CATEGORY_LABELS: Record<RawMaterialCategory, string> = {
  fragrance: 'Parfum',
  wax: 'Cire',
  dye: 'Colorant',
  additive: 'Additif',
  wick: 'Mèche',
  other: 'Autre',
}
