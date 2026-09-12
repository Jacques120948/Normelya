import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type pg from 'pg'
import { asUser, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Tests d'isolation.
 *
 * Ils vérifient qu'un membre d'une organisation ne peut accéder à aucune donnée
 * d'une autre organisation, y compris en formulant la requête lui-même. Ils
 * s'exécutent avec le rôle applicatif, non propriétaire et sans BYPASSRLS —
 * c'est-à-dire dans les conditions réelles de production.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

describeDb('isolation des données entre organisations (RLS)', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string

  const atelierA = { org: '', user: '' }
  const atelierB = { org: '', user: '' }
  let intrus = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const creerUtilisateur = async (email: string) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (auth_provider, auth_subject, email, email_verified_at)
           VALUES ('test', $1, $2, now()) RETURNING id`,
          [email, email],
        )
        return rows[0]!.id
      }
      const creerOrganisation = async (name: string) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO organizations (name, country) VALUES ($1, 'FR') RETURNING id`,
          [name],
        )
        return rows[0]!.id
      }

      atelierA.user = await creerUtilisateur('a@exemple.fr')
      atelierB.user = await creerUtilisateur('b@exemple.fr')
      intrus = await creerUtilisateur('intrus@exemple.fr')
      atelierA.org = await creerOrganisation('DEMO Atelier A')
      atelierB.org = await creerOrganisation('DEMO Atelier B')

      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`,
        [atelierA.org, atelierA.user, atelierB.org, atelierB.user],
      )

      await client.query(
        `INSERT INTO raw_materials (organization_id, name, category, created_by)
         VALUES ($1, 'DEMO Cire de soja', 'wax', $2),
                ($3, 'DEMO Parfum secret', 'fragrance', $4)`,
        [atelierA.org, atelierA.user, atelierB.org, atelierB.user],
      )
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('un membre ne voit que les matières de son organisation', async () => {
    const vueA = await asUser(pool, atelierA.user, async (client) => {
      const { rows } = await client.query('SELECT name FROM raw_materials ORDER BY name')
      return rows.map((r) => r.name)
    })
    expect(vueA).toEqual(['DEMO Cire de soja'])

    const vueB = await asUser(pool, atelierB.user, async (client) => {
      const { rows } = await client.query('SELECT name FROM raw_materials ORDER BY name')
      return rows.map((r) => r.name)
    })
    expect(vueB).toEqual(['DEMO Parfum secret'])
  })

  it('un utilisateur sans organisation ne voit rien', async () => {
    const vue = await asUser(pool, intrus, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS total FROM raw_materials')
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })

  it('une requête sans contexte utilisateur ne renvoie rien', async () => {
    const vue = await asUser(pool, null, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS total FROM raw_materials')
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })

  it('cibler explicitement l’organisation d’autrui ne contourne pas l’isolation', async () => {
    const vue = await asUser(pool, atelierA.user, async (client) => {
      const { rows } = await client.query(
        'SELECT count(*)::int AS total FROM raw_materials WHERE organization_id = $1',
        [atelierB.org],
      )
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })

  it('écrire dans l’organisation d’autrui est refusé', async () => {
    await expect(
      asUser(pool, atelierA.user, async (client) => {
        await client.query(
          `INSERT INTO raw_materials (organization_id, name, category)
           VALUES ($1, 'Injection', 'other')`,
          [atelierB.org],
        )
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('un contexte d’organisation explicite restreint encore la visibilité', async () => {
    const vue = await asUser(
      pool,
      atelierA.user,
      async (client) => {
        const { rows } = await client.query('SELECT count(*)::int AS total FROM raw_materials')
        return rows[0]!.total
      },
      atelierB.org,
    )
    expect(vue).toBe(0)
  })

  it('les organisations elles-mêmes sont isolées', async () => {
    const vue = await asUser(pool, atelierA.user, async (client) => {
      const { rows } = await client.query('SELECT name FROM organizations')
      return rows.map((r) => r.name)
    })
    expect(vue).toEqual(['DEMO Atelier A'])
  })

  it('le journal des paiements est inaccessible au rôle applicatif', async () => {
    await expect(
      asUser(pool, atelierA.user, async (client) => {
        await client.query('SELECT * FROM payment_events')
      }),
    ).rejects.toThrow(/permission denied/i)
  })

  it('un utilisateur ne peut pas forger une trace d’audit', async () => {
    await expect(
      asUser(pool, atelierA.user, async (client) => {
        await client.query(
          `INSERT INTO audit_logs (organization_id, action, entity_type)
           VALUES ($1, 'faux', 'test')`,
          [atelierA.org],
        )
      }),
    ).rejects.toThrow(/permission denied/i)
  })
})

describeDb('rôles et droits', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string
  const proprietaire = { org: '', user: '' }
  let lecteur = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u1 } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email) VALUES ('test','o','o@exemple.fr') RETURNING id`,
      )
      const { rows: u2 } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email) VALUES ('test','v','v@exemple.fr') RETURNING id`,
      )
      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Atelier', 'CH') RETURNING id`,
      )
      proprietaire.user = u1[0]!.id
      lecteur = u2[0]!.id
      proprietaire.org = o[0]!.id
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner'), ($1, $3, 'viewer')`,
        [proprietaire.org, proprietaire.user, lecteur],
      )
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('un lecteur voit les matières mais ne peut pas en créer', async () => {
    const vue = await asUser(pool, lecteur, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS total FROM raw_materials')
      return rows[0]!.total
    })
    expect(vue).toBe(0)

    await expect(
      asUser(pool, lecteur, async (client) => {
        await client.query(
          `INSERT INTO raw_materials (organization_id, name, category)
           VALUES ($1, 'DEMO Cire', 'wax')`,
          [proprietaire.org],
        )
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('un propriétaire peut créer une matière', async () => {
    const id = await asUser(pool, proprietaire.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO raw_materials (organization_id, name, category)
         VALUES ($1, 'DEMO Cire de colza', 'wax') RETURNING id`,
        [proprietaire.org],
      )
      return rows[0]!.id
    })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('un lecteur ne peut pas modifier les informations de l’atelier', async () => {
    await expect(
      asUser(pool, lecteur, async (client) => {
        const { rowCount } = await client.query(
          `UPDATE organizations SET name = 'Détourné' WHERE id = $1`,
          [proprietaire.org],
        )
        if (rowCount === 0) throw new Error('aucune ligne modifiée')
      }),
    ).rejects.toThrow(/aucune ligne modifiée/)
  })
})
