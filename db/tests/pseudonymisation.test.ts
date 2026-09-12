import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Pseudonymisation et purge des attestations de validation.
 *
 * Décision du 12 septembre 2026 : conservation avec pseudonymisation, puis
 * purge automatique dix ans après la suppression du compte.
 * Voir docs/18-conservation-des-attestations.md
 */
const describeDb = hasTestDatabase ? describe : describe.skip

const DECLARATION = 'Je confirme avoir vérifié ces informations.'
const empreinte = (valeur: string) => createHash('sha256').update(valeur).digest('hex')

describeDb('conservation des attestations', () => {
  let dropDatabase: () => Promise<void>
  let databaseName: string
  const atelier = { org: '', user: '' }
  let idAttestation = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email, first_name, last_name)
         VALUES ('test', 'attestant', 'attestant@exemple.fr', 'Camille', 'Durand') RETURNING id`,
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
      const { rows: a } = await client.query<{ id: string }>(
        `INSERT INTO validation_attestations
           (organization_id, user_id, scope, entity_type, entity_id, data_hash,
            statement_text, attested_by_name, attested_by_email)
         VALUES ($1, $2, 'recipe', 'product', $1, $3, $4, 'Camille Durand', 'attestant@exemple.fr')
         RETURNING id`,
        [atelier.org, atelier.user, empreinte('recette'), DECLARATION],
      )
      idAttestation = a[0]!.id
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  async function lireAttestation() {
    return seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT user_id, attested_by_name, attested_by_email, data_hash, statement_text,
                accepted_at, pseudonymized_at, purge_due_on
         FROM validation_attestations WHERE id = $1`,
        [idAttestation],
      )
      return rows[0] ?? null
    })
  }

  it('porte l’identité de la personne tant que le compte existe', async () => {
    const attestation = await lireAttestation()
    expect(attestation.attested_by_name).toBe('Camille Durand')
    expect(attestation.attested_by_email).toBe('attestant@exemple.fr')
    expect(attestation.pseudonymized_at).toBeNull()
    expect(attestation.purge_due_on).toBeNull()
  })

  it('refuse toute modification hors opération d’effacement', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(`UPDATE validation_attestations SET attested_by_name = 'Autre' WHERE id = $1`, [
          idAttestation,
        ]),
      ),
    ).rejects.toThrow(/ne peut être que dissociée|append-only/)
  })

  it('efface le nom et l’adresse à la suppression du compte, et conserve le reste', async () => {
    const traitees = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ pseudonymize_attestations: number }>(
        `SELECT app.pseudonymize_attestations($1, now())`,
        [atelier.user],
      )
      return rows[0]!.pseudonymize_attestations
    })
    expect(traitees).toBe(1)

    const attestation = await lireAttestation()
    // Effacé.
    expect(attestation.attested_by_name).toBeNull()
    expect(attestation.attested_by_email).toBeNull()
    // Conservé : identifiant technique, horodatage, empreinte, déclaration.
    expect(attestation.user_id).toBe(atelier.user)
    expect(attestation.accepted_at).toBeInstanceOf(Date)
    expect(attestation.data_hash).toBe(empreinte('recette'))
    expect(attestation.statement_text).toBe(DECLARATION)
    // Daté, et date de purge posée.
    expect(attestation.pseudonymized_at).toBeInstanceOf(Date)
    expect(attestation.purge_due_on).toBeInstanceOf(Date)
  })

  it('fixe la purge à dix ans après la suppression du compte', async () => {
    const attestation = await lireAttestation()
    const pseudonymisee = new Date(attestation.pseudonymized_at)
    const purge = new Date(attestation.purge_due_on)
    expect(purge.getUTCFullYear() - pseudonymisee.getUTCFullYear()).toBe(10)
  })

  it('ne pseudonymise pas deux fois', async () => {
    const traitees = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ pseudonymize_attestations: number }>(
        `SELECT app.pseudonymize_attestations($1, now())`,
        [atelier.user],
      )
      return rows[0]!.pseudonymize_attestations
    })
    expect(traitees).toBe(0)
  })

  it('ne purge rien avant l’échéance', async () => {
    const attestation = await lireAttestation()
    const veille = new Date(attestation.purge_due_on)
    veille.setUTCDate(veille.getUTCDate() - 1)

    const supprimees = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ purge_expired_attestations: number }>(
        `SELECT app.purge_expired_attestations($1)`,
        [veille.toISOString().slice(0, 10)],
      )
      return rows[0]!.purge_expired_attestations
    })
    expect(supprimees).toBe(0)
    expect(await lireAttestation()).not.toBeNull()
  })

  it('purge à l’échéance', async () => {
    const attestation = await lireAttestation()
    const echeance = new Date(attestation.purge_due_on).toISOString().slice(0, 10)

    const supprimees = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ purge_expired_attestations: number }>(
        `SELECT app.purge_expired_attestations($1)`,
        [echeance],
      )
      return rows[0]!.purge_expired_attestations
    })
    expect(supprimees).toBe(1)
    expect(await lireAttestation()).toBeNull()
  })

  it('ne touche jamais une attestation dont le compte existe encore', async () => {
    const vivante = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO validation_attestations
           (organization_id, user_id, scope, entity_type, entity_id, data_hash,
            statement_text, attested_by_name)
         VALUES ($1, $2, 'recipe', 'product', $1, $3, $4, 'Camille Durand')
         RETURNING id`,
        [atelier.org, atelier.user, empreinte('autre'), DECLARATION],
      )
      return rows[0]!.id
    })

    // Sa date de purge n'est pas posée : elle ne l'est qu'à la pseudonymisation.
    const supprimees = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query<{ purge_expired_attestations: number }>(
        `SELECT app.purge_expired_attestations('2099-12-31')`,
      )
      return rows[0]!.purge_expired_attestations
    })
    expect(supprimees).toBe(0)

    const restante = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT attested_by_name FROM validation_attestations WHERE id = $1`,
        [vivante],
      )
      return rows[0] ?? null
    })
    expect(restante?.attested_by_name).toBe('Camille Durand')
  })

  it('interdit une attestation pseudonymisée sans date de purge', async () => {
    await expect(
      seedAsOwner(databaseName, async (client) => {
        await client.query('BEGIN')
        await client.query(`SELECT set_config('app.erasure_mode', 'on', true)`)
        await client.query(
          `UPDATE validation_attestations
           SET attested_by_name = NULL, attested_by_email = NULL, pseudonymized_at = now()
           WHERE pseudonymized_at IS NULL`,
        )
        await client.query('COMMIT')
      }),
    ).rejects.toThrow(/pseudonymisation_coherente/)
  })
})
