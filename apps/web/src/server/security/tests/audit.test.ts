import { describe, expect, it, vi } from 'vitest'
import type { DatabaseClient } from '../../ports/database'
import { diffFields, recordAudit } from '../audit'

function clientFactice(comportement?: { echoue?: boolean }) {
  const appels: Array<{ sql: string; params: unknown[] }> = []
  const client: DatabaseClient = {
    query: async (sql, params) => {
      if (comportement?.echoue) throw new Error('base indisponible')
      appels.push({ sql, params: params ?? [] })
      return []
    },
    queryOne: async () => null,
  }
  return { client, appels }
}

describe('journal d’audit', () => {
  it('enregistre une action avec ses empreintes, jamais les valeurs en clair', async () => {
    const { client, appels } = clientFactice()
    await recordAudit(client, {
      organizationId: 'org-1',
      actorUserId: 'user-1',
      action: 'product.created',
      entityType: 'product',
      entityId: 'prod-1',
      ip: '192.168.1.42',
      userAgent: 'Mozilla/5.0',
    })

    expect(appels).toHaveLength(1)
    const params = appels[0]!.params as string[]
    expect(params[3]).toBe('product.created')
    expect(params.join(' ')).not.toContain('192.168.1.42')
    expect(params.join(' ')).not.toContain('Mozilla')
    expect(params[8]).toMatch(/^[0-9a-f]{64}$/)
  })

  it('ne fait jamais échouer l’action métier quand la trace échoue', async () => {
    const { client } = clientFactice({ echoue: true })
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      recordAudit(client, {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        action: 'product.created',
        entityType: 'product',
      }),
    ).resolves.toBeUndefined()

    expect(erreur).toHaveBeenCalled()
    erreur.mockRestore()
  })

  it('ne retient que les champs réellement modifiés', () => {
    const avant = { name: 'Bougie', percent: 9, notes: 'rien' }
    const apres = { name: 'Bougie', percent: 10, notes: 'rien' }
    expect(diffFields(avant, apres)).toEqual({
      before: { percent: 9 },
      after: { percent: 10 },
    })
  })

  it('détecte l’ajout et la suppression d’un champ', () => {
    const diff = diffFields(
      { a: 1 } as Record<string, unknown>,
      { a: 1, b: 2 } as Record<string, unknown>,
    )
    expect(diff.after).toEqual({ b: 2 })
  })
})
