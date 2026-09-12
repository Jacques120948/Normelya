import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import type pg from 'pg'
import { asUser, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Attestations de validation humaine.
 *
 * C'est la principale pièce de défense en cas de litige : elle enregistre ce que
 * l'utilisateur a confirmé avoir vérifié, quand, et sur quelles données
 * exactement. Ces tests vérifient qu'elle ne peut être ni réécrite, ni forgée au
 * nom d'autrui, ni contournée lors d'une génération de document.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

const DECLARATION = 'Je confirme avoir vérifié ces informations.'
const empreinte = (valeur: string) => createHash('sha256').update(valeur).digest('hex')

describeDb('attestations de validation', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string

  const atelier = { org: '', user: '', collegue: '' }
  let idProduit = ''
  let idAttestation = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const creerUtilisateur = async (sujet: string) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (auth_provider, auth_subject, email)
           VALUES ('test', $1, $2) RETURNING id`,
          [sujet, `${sujet}@exemple.fr`],
        )
        return rows[0]!.id
      }

      atelier.user = await creerUtilisateur('proprietaire')
      atelier.collegue = await creerUtilisateur('collegue')

      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Atelier', 'FR') RETURNING id`,
      )
      atelier.org = o[0]!.id

      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner'), ($1, $3, 'member')`,
        [atelier.org, atelier.user, atelier.collegue],
      )

      const { rows: p } = await client.query<{ id: string }>(
        `INSERT INTO products (organization_id, name, product_type)
         VALUES ($1, 'DEMO Bougie', 'candle') RETURNING id`,
        [atelier.org],
      )
      idProduit = p[0]!.id
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('enregistre qui a validé, quand, et l’empreinte de ce qui a été validé', async () => {
    const donneesValidees = JSON.stringify({ produit: 'DEMO Bougie', cire: 91, parfum: 9 })

    idAttestation = await asUser(pool, atelier.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO validation_attestations
           (organization_id, user_id, scope, entity_type, entity_id, data_hash, statement_text)
         VALUES ($1, $2, 'recipe', 'product', $3, $4, $5)
         RETURNING id`,
        [atelier.org, atelier.user, idProduit, empreinte(donneesValidees), DECLARATION],
      )
      return rows[0]!.id
    })

    const trace = await asUser(pool, atelier.user, async (client) => {
      const { rows } = await client.query(
        `SELECT user_id, accepted_at, data_hash, statement_text, scope::text
         FROM validation_attestations WHERE id = $1`,
        [idAttestation],
      )
      return rows[0]!
    })

    expect(trace.user_id).toBe(atelier.user)
    expect(trace.accepted_at).toBeInstanceOf(Date)
    expect(trace.data_hash).toBe(empreinte(donneesValidees))
    // Le texte exact accepté est conservé mot pour mot.
    expect(trace.statement_text).toBe(DECLARATION)
    expect(trace.scope).toBe('recipe')
  })

  it('détecte une modification ultérieure des données validées', async () => {
    const attestation = await asUser(pool, atelier.user, async (client) => {
      const { rows } = await client.query<{ data_hash: string }>(
        `SELECT data_hash FROM validation_attestations WHERE id = $1`,
        [idAttestation],
      )
      return rows[0]!
    })

    const donneesModifiees = JSON.stringify({ produit: 'DEMO Bougie', cire: 88, parfum: 12 })
    expect(empreinte(donneesModifiees)).not.toBe(attestation.data_hash)
  })

  it('refuse une attestation au nom d’un autre utilisateur', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO validation_attestations
             (organization_id, user_id, scope, entity_type, entity_id, data_hash, statement_text)
           VALUES ($1, $2, 'recipe', 'product', $3, $4, $5)`,
          [atelier.org, atelier.collegue, idProduit, empreinte('x'), DECLARATION],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('refuse une empreinte mal formée', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO validation_attestations
             (organization_id, user_id, scope, entity_type, entity_id, data_hash, statement_text)
           VALUES ($1, $2, 'recipe', 'product', $3, 'pas-une-empreinte', $4)`,
          [atelier.org, atelier.user, idProduit, DECLARATION],
        ),
      ),
    ).rejects.toThrow(/validation_attestations_hash_format/)
  })

  it('refuse une déclaration vide', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO validation_attestations
             (organization_id, user_id, scope, entity_type, entity_id, data_hash, statement_text)
           VALUES ($1, $2, 'recipe', 'product', $3, $4, '   ')`,
          [atelier.org, atelier.user, idProduit, empreinte('y')],
        ),
      ),
    ).rejects.toThrow(/validation_attestations_statement_not_blank/)
  })

  it('ne peut être ni modifiée ni supprimée, même par un rôle privilégié', async () => {
    const touchees = await asUser(pool, atelier.user, async (client) => {
      const majes = await client.query(
        `UPDATE validation_attestations SET statement_text = 'autre chose' WHERE id = $1`,
        [idAttestation],
      )
      const suppressions = await client.query(
        `DELETE FROM validation_attestations WHERE id = $1`,
        [idAttestation],
      )
      return (majes.rowCount ?? 0) + (suppressions.rowCount ?? 0)
    })
    expect(touchees).toBe(0)

    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(
          `UPDATE validation_attestations SET data_hash = $2 WHERE id = $1`,
          [idAttestation, empreinte('falsifie')],
        ),
      ),
    ).rejects.toThrow(/append-only/i)
  })

  it('un membre d’un autre atelier ne voit aucune attestation', async () => {
    const intrus = await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email)
         VALUES ('test', 'intrus', 'intrus@exemple.fr') RETURNING id`,
      )
      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Voisin', 'CH') RETURNING id`,
      )
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [o[0]!.id, u[0]!.id],
      )
      return u[0]!.id
    })

    const vue = await asUser(pool, intrus, async (client) => {
      const { rows } = await client.query('SELECT count(*)::int AS total FROM validation_attestations')
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })
})

describeDb('génération de document conditionnée à une attestation', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string
  const atelier = { org: '', user: '' }
  let idDocument = ''
  let idAttestation = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email)
         VALUES ('test', 'doc', 'doc@exemple.fr') RETURNING id`,
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
      const { rows: d } = await client.query<{ id: string }>(
        `INSERT INTO documents (organization_id, kind, storage_key, original_filename,
                                mime_type, byte_size, sha256)
         VALUES ($1, 'label', 'demo/etiquette.pdf', 'etiquette.pdf', 'application/pdf',
                 2048, repeat('c', 64))
         RETURNING id`,
        [atelier.org],
      )
      idDocument = d[0]!.id
    })

    idAttestation = await asUser(pool, atelier.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO validation_attestations
           (organization_id, user_id, scope, entity_type, entity_id, data_hash, statement_text)
         VALUES ($1, $2, 'document_generation', 'label', $1, $3, $4)
         RETURNING id`,
        [atelier.org, atelier.user, empreinte('etiquette'), DECLARATION],
      )
      return rows[0]!.id
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('refuse une étiquette générée sans attestation', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO generated_documents (organization_id, document_id, type)
           VALUES ($1, $2, 'label_pdf')`,
          [atelier.org, idDocument],
        ),
      ),
    ).rejects.toThrow(/generated_documents_attestation_required/)
  })

  it('refuse une fiche de produit dilué générée sans attestation', async () => {
    await expect(
      asUser(pool, atelier.user, (client) =>
        client.query(
          `INSERT INTO generated_documents (organization_id, document_id, type)
           VALUES ($1, $2, 'product_sds_pdf')`,
          [atelier.org, idDocument],
        ),
      ),
    ).rejects.toThrow(/generated_documents_attestation_required/)
  })

  it('accepte une étiquette rattachée à son attestation', async () => {
    const id = await asUser(pool, atelier.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO generated_documents
           (organization_id, document_id, type, validation_attestation_id, format_reference)
         VALUES ($1, $2, 'label_pdf', $3, 'CLP')
         RETURNING id`,
        [atelier.org, idDocument, idAttestation],
      )
      return rows[0]!.id
    })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('laisse un export de données personnelles se passer d’attestation', async () => {
    const id = await asUser(pool, atelier.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO generated_documents (organization_id, document_id, type)
         VALUES ($1, $2, 'data_export') RETURNING id`,
        [atelier.org, idDocument],
      )
      return rows[0]!.id
    })
    expect(id).toBeTruthy()
  })
})
