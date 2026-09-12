import { describe, expect, it } from 'vitest'
import { checkQuota, PLANS, PLAN_CODES, planHasFeature } from '../src/plans'

describe('offres et quotas', () => {
  it('applique deux mois offerts sur l’engagement annuel', () => {
    for (const code of PLAN_CODES) {
      const plan = PLANS[code]
      expect(plan.priceYearlyCents).toBe(plan.priceMonthlyCents * 10)
    }
  })

  it('respecte les tarifs annoncés', () => {
    expect(PLANS.free.priceMonthlyCents).toBe(0)
    expect(PLANS.essential.priceMonthlyCents).toBe(990)
    expect(PLANS.pro.priceMonthlyCents).toBe(1990)
    expect(PLANS.atelier.priceMonthlyCents).toBe(2990)
  })

  it('laisse l’offre gratuite créer 3 produits, pas 4', () => {
    expect(checkQuota('free', 'active_products', 2)).toEqual({ allowed: true, remaining: 1 })
    const blocked = checkQuota('free', 'active_products', 3)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed) throw new Error('inattendu')
    expect(blocked.limit).toBe(3)
    expect(blocked.message).toContain('3 produits actifs')
  })

  it('laisse l’offre Pro créer un nombre illimité de produits', () => {
    expect(checkQuota('pro', 'active_products', 10_000)).toEqual({ allowed: true, remaining: null })
  })

  it('convertit la limite de stockage en octets', () => {
    const blocked = checkQuota('essential', 'storage_bytes', 500 * 1024 * 1024)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed) throw new Error('inattendu')
    expect(blocked.limit).toBe(500 * 1024 * 1024)
  })

  it('indique que la saisie manuelle reste possible quand le quota IA est atteint', () => {
    const blocked = checkQuota('free', 'ai_extractions', 5)
    expect(blocked.allowed).toBe(false)
    if (blocked.allowed) throw new Error('inattendu')
    expect(blocked.message).toContain('saisie manuelle')
  })

  it('réserve l’assistant, l’UFI et les lots aux offres prévues', () => {
    expect(planHasFeature('free', 'assistant')).toBe(false)
    expect(planHasFeature('essential', 'ufi')).toBe(false)
    expect(planHasFeature('pro', 'assistant')).toBe(true)
    expect(planHasFeature('pro', 'lots')).toBe(false)
    expect(planHasFeature('atelier', 'lots')).toBe(true)
    expect(planHasFeature('atelier', 'costing')).toBe(true)
  })
})
