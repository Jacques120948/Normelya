import { describe, expect, it } from 'vitest'
import {
  checkQuota,
  PLANS,
  PLAN_CODES,
  planHasFeature,
  productCreationMetrics,
} from '../src/plans'

describe('offres et quotas', () => {
  it('applique deux mois offerts sur l’engagement annuel', () => {
    for (const code of PLAN_CODES) {
      const plan = PLANS[code]
      expect(plan.priceYearlyCents).toBe(plan.priceMonthlyCents * 10)
    }
  })

  it('respecte les tarifs annoncés', () => {
    expect(PLANS.free.priceMonthlyCents).toBe(0)
    expect(PLANS.essential.priceMonthlyCents).toBe(900)
    expect(PLANS.pro.priceMonthlyCents).toBe(1500)
    expect(PLANS.atelier.priceMonthlyCents).toBe(2500)
  })

  it('respecte les plafonds de produits annoncés', () => {
    expect(PLANS.free.maxActiveProducts).toBe(3)
    expect(PLANS.essential.maxActiveProducts).toBe(15)
    expect(PLANS.pro.maxActiveProducts).toBeNull()
    expect(PLANS.atelier.maxActiveProducts).toBeNull()
  })

  describe('offre gratuite : quota non renouvelable', () => {
    it('plafonne aussi le nombre total de produits jamais créés', () => {
      expect(PLANS.free.maxLifetimeProducts).toBe(3)
      expect(productCreationMetrics('free')).toEqual(['active_products', 'lifetime_products'])
    })

    it('n’applique aucun plafond cumulatif aux offres payantes', () => {
      for (const code of ['essential', 'pro', 'atelier'] as const) {
        expect(PLANS[code].maxLifetimeProducts).toBeNull()
        expect(productCreationMetrics(code)).toEqual(['active_products'])
      }
    })

    it('refuse un quatrième produit même si les trois premiers sont archivés', () => {
      // Aucun produit actif, mais trois déjà créés : le quota est épuisé.
      expect(checkQuota('free', 'active_products', 0)).toEqual({ allowed: true, remaining: 3 })

      const bloque = checkQuota('free', 'lifetime_products', 3)
      expect(bloque.allowed).toBe(false)
      if (bloque.allowed) throw new Error('inattendu')
      expect(bloque.message).toContain('n’est pas renouvelable')
    })
  })

  it('laisse l’offre gratuite créer 3 produits, pas 4', () => {
    expect(checkQuota('free', 'active_products', 2)).toEqual({ allowed: true, remaining: 1 })
    const bloque = checkQuota('free', 'active_products', 3)
    expect(bloque.allowed).toBe(false)
    if (bloque.allowed) throw new Error('inattendu')
    expect(bloque.limit).toBe(3)
    expect(bloque.message).toContain('3 produits actifs')
  })

  it('laisse l’offre Essentiel créer quinze produits actifs', () => {
    expect(checkQuota('essential', 'active_products', 14)).toEqual({
      allowed: true,
      remaining: 1,
    })
    expect(checkQuota('essential', 'active_products', 15).allowed).toBe(false)
  })

  it('laisse l’offre Pro créer un nombre illimité de produits', () => {
    expect(checkQuota('pro', 'active_products', 10_000)).toEqual({ allowed: true, remaining: null })
    expect(checkQuota('pro', 'lifetime_products', 10_000)).toEqual({
      allowed: true,
      remaining: null,
    })
  })

  it('convertit la limite de stockage en octets', () => {
    const bloque = checkQuota('essential', 'storage_bytes', 500 * 1024 * 1024)
    expect(bloque.allowed).toBe(false)
    if (bloque.allowed) throw new Error('inattendu')
    expect(bloque.limit).toBe(500 * 1024 * 1024)
  })

  it('indique que la saisie manuelle reste possible quand le quota IA est atteint', () => {
    const bloque = checkQuota('free', 'ai_extractions', 5)
    expect(bloque.allowed).toBe(false)
    if (bloque.allowed) throw new Error('inattendu')
    expect(bloque.message).toContain('saisie manuelle')
  })

  it('réserve la FDS du produit dilué, l’UFI, l’archivage et les lots aux offres prévues', () => {
    expect(planHasFeature('free', 'product_sds')).toBe(false)
    expect(planHasFeature('essential', 'product_sds')).toBe(false)
    expect(planHasFeature('essential', 'ufi')).toBe(false)
    expect(planHasFeature('essential', 'document_archive')).toBe(false)

    expect(planHasFeature('pro', 'product_sds')).toBe(true)
    expect(planHasFeature('pro', 'ufi')).toBe(true)
    expect(planHasFeature('pro', 'document_archive')).toBe(true)
    expect(planHasFeature('pro', 'assistant')).toBe(true)
    expect(planHasFeature('pro', 'lots')).toBe(false)

    expect(planHasFeature('atelier', 'lots')).toBe(true)
    expect(planHasFeature('atelier', 'costing')).toBe(true)
  })
})
