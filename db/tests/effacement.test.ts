import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type pg from 'pg'
import { asUser, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Garde append-only et droit à l'effacement.
 *
 * Ces tests vérifient que l'immuabilité protège contre la réécriture ordinaire
 * sans faire obstacle à l'exercice d'un droit, et que l'exception reste étroite.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

describeDb('immuabilité des traces', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string
  const atelier = { org: '', user: '' }
  let idTrace = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email)
         VALUES ('test', 'effacement', 'effacement@exemple.fr') RETURNING id`,
      )
      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Atelier', 'FR') RETURNING id`,
      )
      atelier.user = u[0]!.id
      atelier.org = o[0]!.id
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [atelier.org, atelier.user],
      )
      const { rows: t } = await client.query<{ id: string }>(
        `INSERT INTO audit_logs (organization_id, actor_user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'product.created', 'product', $1) RETURNING id`,
        [atelier.org, atelier.user],
      )
      idTrace = t[0]!.id
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('refuse de modifier le contenu d’une trace', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(`UPDATE audit_logs SET action = 'autre.action' WHERE id = $1`, [idTrace]),
      ),
    ).rejects.toThrow(/aucune modification n'est autorisée/)
  })

  it('refuse de réaffecter une trace à une autre personne', async () => {
    await expect(
      seedAsOwner(databaseName, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (auth_provider, auth_subject, email)
           VALUES ('test', 'autre', 'autre@exemple.fr') RETURNING id`,
        )
        await client.query(`UPDATE audit_logs SET actor_user_id = $2 WHERE id = $1`, [
          idTrace,
          rows[0]!.id,
        ])
      }),
    ).rejects.toThrow(/ne peut être que dissociée, pas réaffectée/)
  })

  it('refuse une dissociation accompagnée d’une autre modification', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(
          `UPDATE audit_logs SET actor_user_id = NULL, action = 'falsifie' WHERE id = $1`,
          [idTrace],
        ),
      ),
    ).rejects.toThrow(/le contenu de la trace ne peut pas être modifié/)
  })

  it('refuse la suppression hors mode effacement', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(`DELETE FROM audit_logs WHERE id = $1`, [idTrace]),
      ),
    ).rejects.toThrow(/effacement explicite/)
  })

  it('autorise la seule dissociation d’un compte supprimé', async () => {
    // C'est ce que produit ON DELETE SET NULL lors d'un effacement.
    await seedAsOwner(databaseName, (client) =>
      client.query(`UPDATE audit_logs SET actor_user_id = NULL WHERE id = $1`, [idTrace]),
    )

    const trace = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT actor_user_id, action, entity_type FROM audit_logs WHERE id = $1`,
        [idTrace],
      )
      return rows[0]!
    })

    // Le lien vers la personne est coupé, le contenu de la trace est intact.
    expect(trace.actor_user_id).toBeNull()
    expect(trace.action).toBe('product.created')
    expect(trace.entity_type).toBe('product')
  })

  it('autorise la suppression en mode effacement, et seulement là', async () => {
    await seedAsOwner(databaseName, async (client) => {
      await client.query('BEGIN')
      await client.query(`SELECT set_config('app.erasure_mode', 'on', true)`)
      await client.query(`DELETE FROM audit_logs WHERE id = $1`, [idTrace])
      await client.query('COMMIT')
    })

    const restantes = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM audit_logs WHERE id = $1`,
        [idTrace],
      )
      return Number(rows[0]!.total)
    })
    expect(restantes).toBe(0)
  })

  it('le mode effacement ne survit pas à sa transaction', async () => {
    const idAutre = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO audit_logs (organization_id, action, entity_type)
         VALUES ($1, 'test', 'test') RETURNING id`,
        [atelier.org],
      )
      return rows[0]!.id
    })

    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(`DELETE FROM audit_logs WHERE id = $1`, [idAutre]),
      ),
    ).rejects.toThrow(/effacement explicite/)
  })

  it('le rôle applicatif ne peut pas activer le mode effacement pour supprimer', async () => {
    const idProtegee = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO audit_logs (organization_id, action, entity_type)
         VALUES ($1, 'protegee', 'test') RETURNING id`,
        [atelier.org],
      )
      return rows[0]!.id
    })

    // Même en posant le paramètre, le rôle applicatif n'a aucun droit
    // d'écriture sur cette table : les privilèges l'arrêtent avant la garde.
    await expect(
      asUser(pool, atelier.user, async (client) => {
        await client.query(`SELECT set_config('app.erasure_mode', 'on', true)`)
        await client.query(`DELETE FROM audit_logs WHERE id = $1`, [idProtegee])
      }),
    ).rejects.toThrow(/permission denied/i)
  })
})
