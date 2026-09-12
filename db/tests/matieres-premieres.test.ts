import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type pg from 'pg'
import type { DatabaseClient } from '../../apps/web/src/server/ports/database'
import {
  countRawMaterials,
  findOrCreateSupplier,
  findRawMaterial,
  listRawMaterials,
} from '../../apps/web/src/server/repositories/raw-materials'
import { dashboardCounts } from '../../apps/web/src/server/repositories/dashboard'
import { asUser, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Tests d'intégration de la phase 2.
 *
 * Ils exécutent les vraies requêtes des dépôts de données, avec le rôle
 * applicatif soumis aux politiques RLS : ce qui passe ici passera en production.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

/** Adapte un client pg au port DatabaseClient utilisé par les dépôts. */
function adapter(client: pg.PoolClient): DatabaseClient {
  return {
    query: async <T>(sql: string, params?: unknown[]) => {
      const result = await client.query(sql, params as never)
      return result.rows as T[]
    },
    queryOne: async <T>(sql: string, params?: unknown[]) => {
      const result = await client.query(sql, params as never)
      return (result.rows[0] as T | undefined) ?? null
    },
  }
}

describeDb('matières premières', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string

  const atelier = { org: '', user: '' }
  const voisin = { org: '', user: '' }
  let idCire = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const creer = async (suffixe: string, nomAtelier: string) => {
        const { rows: u } = await client.query<{ id: string }>(
          `INSERT INTO users (auth_provider, auth_subject, email)
           VALUES ('test', $1, $2) RETURNING id`,
          [suffixe, `${suffixe}@exemple.fr`],
        )
        const { rows: o } = await client.query<{ id: string }>(
          `INSERT INTO organizations (name, country) VALUES ($1, 'FR') RETURNING id`,
          [nomAtelier],
        )
        await client.query(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'owner')`,
          [o[0]!.id, u[0]!.id],
        )
        return { user: u[0]!.id, org: o[0]!.id }
      }

      Object.assign(atelier, await creer('atelier', 'DEMO Atelier Principal'))
      Object.assign(voisin, await creer('voisin', 'DEMO Atelier Voisin'))
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('crée un fournisseur puis le réutilise sans doublon', async () => {
    const ids = await asUser(pool, atelier.user, async (client) => {
      const db = adapter(client)
      const premier = await findOrCreateSupplier(db, atelier.org, 'DEMO Cirerie du Sud')
      const second = await findOrCreateSupplier(db, atelier.org, '  demo cirerie du sud  ')
      return { premier, second }
    })
    expect(ids.premier).not.toBeNull()
    expect(ids.second).toBe(ids.premier)
  })

  it('ignore un nom de fournisseur vide', async () => {
    const id = await asUser(pool, atelier.user, (client) =>
      findOrCreateSupplier(adapter(client), atelier.org, '   '),
    )
    expect(id).toBeNull()
  })

  it('enregistre une matière et la retrouve avec son fournisseur', async () => {
    idCire = await asUser(pool, atelier.user, async (client) => {
      const fournisseur = await findOrCreateSupplier(
        adapter(client),
        atelier.org,
        'DEMO Cirerie du Sud',
      )
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO raw_materials (organization_id, supplier_id, name, category, internal_reference)
         VALUES ($1, $2, 'DEMO Cire de soja', 'wax', 'CIRE-01') RETURNING id`,
        [atelier.org, fournisseur],
      )
      return rows[0]!.id
    })

    const matiere = await asUser(pool, atelier.user, (client) =>
      findRawMaterial(adapter(client), atelier.org, idCire),
    )

    expect(matiere).not.toBeNull()
    expect(matiere!.name).toBe('DEMO Cire de soja')
    expect(matiere!.supplier_name).toBe('DEMO Cirerie du Sud')
    // Sans fiche de données de sécurité rattachée, l'état est « manquante » :
    // jamais une valeur favorable par défaut.
    expect(matiere!.sds_state).toBe('missing')
    expect(matiere!.document_count).toBe(0)
  })

  it('refuse deux matières portant la même référence interne', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO raw_materials (organization_id, name, category, internal_reference)
           VALUES ($1, 'DEMO Autre cire', 'wax', 'CIRE-01')`,
          [atelier.org],
        ),
      ),
    ).rejects.toThrow(/raw_materials_reference_idx/)
  })

  it('accepte la même référence dans un autre atelier', async () => {
    const id = await asUser(pool, voisin.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO raw_materials (organization_id, name, category, internal_reference)
         VALUES ($1, 'DEMO Cire voisine', 'wax', 'CIRE-01') RETURNING id`,
        [voisin.org],
      )
      return rows[0]!.id
    })
    expect(id).toBeTruthy()
  })

  it('refuse un prix sans quantité ni unité', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO raw_materials (organization_id, name, category, purchase_price_cents)
           VALUES ($1, 'DEMO Parfum', 'fragrance', 2490)`,
          [atelier.org],
        ),
      ),
    ).rejects.toThrow(/raw_materials_purchase_coherent/)
  })

  it('filtre par catégorie et par recherche', async () => {
    await asUser(pool, atelier.user, (client) =>
      client.query(
        `INSERT INTO raw_materials (organization_id, name, category)
         VALUES ($1, 'DEMO Parfum Fleur de coton', 'fragrance')`,
        [atelier.org],
      ),
    )

    const parfums = await asUser(pool, atelier.user, (client) =>
      listRawMaterials(adapter(client), atelier.org, { category: 'fragrance' }),
    )
    expect(parfums.map((m) => m.name)).toEqual(['DEMO Parfum Fleur de coton'])

    const recherche = await asUser(pool, atelier.user, (client) =>
      listRawMaterials(adapter(client), atelier.org, { search: 'cirerie' }),
    )
    // La recherche porte aussi sur le nom du fournisseur.
    expect(recherche.map((m) => m.name)).toEqual(['DEMO Cire de soja'])
  })

  it('ne montre jamais les matières d’un autre atelier', async () => {
    const vue = await asUser(pool, atelier.user, (client) =>
      listRawMaterials(adapter(client), atelier.org, {}),
    )
    expect(vue.every((m) => !m.name.includes('voisine'))).toBe(true)

    // Même en demandant explicitement l'organisation voisine.
    const tentative = await asUser(pool, atelier.user, (client) =>
      listRawMaterials(adapter(client), voisin.org, {}),
    )
    expect(tentative).toEqual([])
  })

  it('exclut les matières archivées par défaut', async () => {
    await asUser(pool, atelier.user, (client) =>
      client.query(`UPDATE raw_materials SET is_archived = true WHERE id = $1`, [idCire]),
    )

    const actives = await asUser(pool, atelier.user, (client) =>
      listRawMaterials(adapter(client), atelier.org, {}),
    )
    expect(actives.map((m) => m.name)).not.toContain('DEMO Cire de soja')

    const toutes = await asUser(pool, atelier.user, (client) =>
      listRawMaterials(adapter(client), atelier.org, { includeArchived: true }),
    )
    expect(toutes.map((m) => m.name)).toContain('DEMO Cire de soja')

    await asUser(pool, atelier.user, (client) =>
      client.query(`UPDATE raw_materials SET is_archived = false WHERE id = $1`, [idCire]),
    )
  })

  it('compte les matières par catégorie et celles sans FDS validée', async () => {
    const compteurs = await asUser(pool, atelier.user, (client) =>
      countRawMaterials(adapter(client), atelier.org),
    )
    expect(compteurs.total).toBe(2)
    expect(compteurs.byCategory.wax).toBe(1)
    expect(compteurs.byCategory.fragrance).toBe(1)
    // Aucune FDS validée : les deux matières sont signalées.
    expect(compteurs.missingSds).toBe(2)
  })
})

describeDb('tableau de bord', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string
  const atelier = { org: '', user: '' }

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email)
         VALUES ('test', 'db', 'db@exemple.fr') RETURNING id`,
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
      await client.query(
        `INSERT INTO raw_materials (organization_id, name, category)
         VALUES ($1, 'DEMO Cire', 'wax'), ($1, 'DEMO Parfum', 'fragrance')`,
        [atelier.org],
      )
      await client.query(
        `INSERT INTO products (organization_id, name, product_type, status)
         VALUES ($1, 'DEMO Bougie', 'candle', 'active')`,
        [atelier.org],
      )
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('compte un produit sans analyse comme « à vérifier », jamais comme analysé', async () => {
    const compteurs = await asUser(pool, atelier.user, (client) =>
      dashboardCounts(adapter(client), atelier.org),
    )
    expect(compteurs.analyzedProducts).toBe(0)
    expect(compteurs.productsToCheck).toBe(1)
    expect(compteurs.rawMaterials).toBe(2)
    expect(compteurs.documentsToUpdate).toBe(0)
  })

  it('renvoie des compteurs à zéro pour un atelier vide', async () => {
    const autre = await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email)
         VALUES ('test', 'vide', 'vide@exemple.fr') RETURNING id`,
      )
      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Vide', 'CH') RETURNING id`,
      )
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [o[0]!.id, u[0]!.id],
      )
      return { user: u[0]!.id, org: o[0]!.id }
    })

    const compteurs = await asUser(pool, autre.user, (client) =>
      dashboardCounts(adapter(client), autre.org),
    )
    expect(compteurs).toEqual({
      analyzedProducts: 0,
      productsToCheck: 0,
      documentsToUpdate: 0,
      rawMaterials: 0,
    })
  })
})
