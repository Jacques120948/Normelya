import { describe, expect, it } from 'vitest'
import { AppError } from '@normelya/core'
import type { DatabaseClient } from '../../ports/database'
import { assertCanCreateProduct, assertWithinQuota, currentUsage } from '../quotas'

function clientAvec(valeurs: Record<string, string>): DatabaseClient {
  return {
    query: async () => [],
    queryOne: async (sql: string) => {
      if (sql.includes('FROM products')) return { total: valeurs.products ?? '0' }
      if (sql.includes('FROM organization_members')) return { total: valeurs.members ?? '0' }
      if (sql.includes('FROM documents')) return { total: valeurs.storage ?? '0' }
      if (sql.includes('usage_counters')) return { value: valeurs.ai ?? '0' }
      return null
    },
  } as DatabaseClient
}

describe('quotas d’offre', () => {
  it('compte les produits actifs réellement présents en base', async () => {
    const usage = await currentUsage(clientAvec({ products: '2' }), 'org-1', 'active_products')
    expect(usage).toBe(2)
  })

  it('laisse passer tant que la limite n’est pas atteinte', async () => {
    await expect(
      assertWithinQuota(clientAvec({ products: '2' }), {
        organizationId: 'org-1',
        plan: 'free',
        metric: 'active_products',
      }),
    ).resolves.toBeUndefined()
  })

  it('refuse le quatrième produit sur l’offre gratuite, avec un message utilisable', async () => {
    await expect(
      assertWithinQuota(clientAvec({ products: '3' }), {
        organizationId: 'org-1',
        plan: 'free',
        metric: 'active_products',
      }),
    ).rejects.toThrow(AppError)

    try {
      await assertWithinQuota(clientAvec({ products: '3' }), {
        organizationId: 'org-1',
        plan: 'free',
        metric: 'active_products',
      })
    } catch (error) {
      const applicative = error as AppError
      expect(applicative.code).toBe('QUOTA_EXCEEDED')
      expect(applicative.userMessage).toContain('3 produits actifs')
      expect(applicative.details).toMatchObject({ limit: 3, current: 3 })
    }
  })

  it('n’impose aucune limite de produits sur l’offre Pro', async () => {
    await expect(
      assertWithinQuota(clientAvec({ products: '5000' }), {
        organizationId: 'org-1',
        plan: 'pro',
        metric: 'active_products',
      }),
    ).resolves.toBeUndefined()
  })

  it('mesure le stockage en octets', async () => {
    const octets = 400 * 1024 * 1024
    await expect(
      assertWithinQuota(clientAvec({ storage: String(octets) }), {
        organizationId: 'org-1',
        plan: 'essential',
        metric: 'storage_bytes',
      }),
    ).resolves.toBeUndefined()

    await expect(
      assertWithinQuota(clientAvec({ storage: String(600 * 1024 * 1024) }), {
        organizationId: 'org-1',
        plan: 'essential',
        metric: 'storage_bytes',
      }),
    ).rejects.toThrow(/500 Mo/)
  })
})

describe('quota non renouvelable de l’offre gratuite', () => {
  function clientAvecCompteurs(valeurs: { actifs?: string; cumules?: string }): DatabaseClient {
    return {
      query: async () => [],
      queryOne: async (sql: string) => {
        if (sql.includes('FROM products')) return { total: valeurs.actifs ?? '0' }
        if (sql.includes("metric = 'lifetime_products'")) return { value: valeurs.cumules ?? '0' }
        return null
      },
    } as DatabaseClient
  }

  it('laisse créer les trois premiers produits', async () => {
    await expect(
      assertCanCreateProduct(clientAvecCompteurs({ actifs: '2', cumules: '2' }), {
        organizationId: 'org-1',
        plan: 'free',
      }),
    ).resolves.toBeUndefined()
  })

  it('refuse le quatrième produit même si les trois premiers sont archivés', async () => {
    // Aucun produit actif : le plafond d'actifs passe. Le plafond cumulatif bloque.
    await expect(
      assertCanCreateProduct(clientAvecCompteurs({ actifs: '0', cumules: '3' }), {
        organizationId: 'org-1',
        plan: 'free',
      }),
    ).rejects.toThrow(/n’est pas renouvelable/)
  })

  it('n’applique aucun plafond cumulatif aux offres payantes', async () => {
    await expect(
      assertCanCreateProduct(clientAvecCompteurs({ actifs: '14', cumules: '9999' }), {
        organizationId: 'org-1',
        plan: 'essential',
      }),
    ).resolves.toBeUndefined()
  })

  it('applique le plafond de quinze produits actifs sur l’offre Essentiel', async () => {
    await expect(
      assertCanCreateProduct(clientAvecCompteurs({ actifs: '15', cumules: '9999' }), {
        organizationId: 'org-1',
        plan: 'essential',
      }),
    ).rejects.toThrow(/15 produits actifs/)
  })
})
