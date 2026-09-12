import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type pg from 'pg'
import { asUser, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Tests de traçabilité.
 *
 * Vérifient qu'un calcul réglementaire est rejouable à l'identique et qu'aucune
 * donnée à valeur probante ne peut être réécrite après coup.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

describeDb('traçabilité des calculs réglementaires', () => {
  let pool: pg.Pool
  let dropDatabase: () => Promise<void>
  let databaseName: string

  const contexte = {
    org: '',
    user: '',
    product: '',
    productVersion: '',
    recipe: '',
    sdsVersion: '',
    calculation: '',
  }

  beforeAll(async () => {
    const created = await createTestDatabase()
    pool = created.pool
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email) VALUES ('test','t','t@exemple.fr') RETURNING id`,
      )
      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Atelier', 'FR') RETURNING id`,
      )
      contexte.user = u[0]!.id
      contexte.org = o[0]!.id
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'owner')`,
        [contexte.org, contexte.user],
      )

      // Matière, FDS validée, document source.
      const { rows: m } = await client.query<{ id: string }>(
        `INSERT INTO raw_materials (organization_id, name, category)
         VALUES ($1, 'DEMO Cire de soja', 'wax') RETURNING id`,
        [contexte.org],
      )
      const { rows: d } = await client.query<{ id: string }>(
        `INSERT INTO documents (organization_id, kind, storage_key, original_filename, mime_type, byte_size, sha256)
         VALUES ($1, 'sds', 'demo/fds-v1.pdf', 'DEMO fds.pdf', 'application/pdf', 1024, repeat('a', 64))
         RETURNING id`,
        [contexte.org],
      )
      const { rows: s } = await client.query<{ id: string }>(
        `INSERT INTO safety_data_sheets (organization_id, raw_material_id, commercial_name)
         VALUES ($1, $2, 'DEMO Cire de soja') RETURNING id`,
        [contexte.org, m[0]!.id],
      )
      const { rows: sv } = await client.query<{ id: string }>(
        `INSERT INTO sds_versions
           (organization_id, safety_data_sheet_id, document_id, version_label, status,
            validated_payload, validated_by, validated_at)
         VALUES ($1, $2, $3, 'V1', 'validated', '{"demo": true}'::jsonb, $4, now())
         RETURNING id`,
        [contexte.org, s[0]!.id, d[0]!.id, contexte.user],
      )
      contexte.sdsVersion = sv[0]!.id

      // Produit, version, recette.
      const { rows: p } = await client.query<{ id: string }>(
        `INSERT INTO products (organization_id, name, product_type, status)
         VALUES ($1, 'DEMO Bougie', 'candle', 'active') RETURNING id`,
        [contexte.org],
      )
      contexte.product = p[0]!.id
      const { rows: pv } = await client.query<{ id: string }>(
        `INSERT INTO product_versions (organization_id, product_id, version_number, name_snapshot, markets)
         VALUES ($1, $2, 1, 'DEMO Bougie', '{FR}') RETURNING id`,
        [contexte.org, contexte.product],
      )
      contexte.productVersion = pv[0]!.id
      const { rows: r } = await client.query<{ id: string }>(
        `INSERT INTO recipes (organization_id, product_version_id, total_percent)
         VALUES ($1, $2, 100) RETURNING id`,
        [contexte.org, contexte.productVersion],
      )
      contexte.recipe = r[0]!.id
      await client.query(
        `INSERT INTO recipe_ingredients (organization_id, recipe_id, raw_material_id, sds_version_id, percent, role)
         VALUES ($1, $2, $3, $4, 100, 'wax')`,
        [contexte.org, contexte.recipe, m[0]!.id, contexte.sdsVersion],
      )

      // Version de moteur factice, uniquement pour ce test.
      await client.query(
        `INSERT INTO regulatory_engine_versions (code, scope, rules_digest, is_active)
         VALUES ('NORMELYA_TEST_0000', 'EU', repeat('0', 64), false)`,
      )
    })
  }, 60_000)

  afterAll(async () => {
    if (dropDatabase) await dropDatabase()
  })

  it('un calcul mémorise moteur, date, recette, FDS, entrée et résultat', async () => {
    contexte.calculation = await asUser(pool, contexte.user, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO regulatory_calculations
           (organization_id, product_id, product_version_id, recipe_id, market,
            engine_version_code, input_payload, input_digest, sds_version_ids, requested_by)
         VALUES ($1,$2,$3,$4,'FR','NORMELYA_TEST_0000',
                 '{"ingredients":[{"percent":100}]}'::jsonb, repeat('b', 64), ARRAY[$5]::uuid[], $6)
         RETURNING id`,
        [
          contexte.org,
          contexte.product,
          contexte.productVersion,
          contexte.recipe,
          contexte.sdsVersion,
          contexte.user,
        ],
      )
      const id = rows[0]!.id
      await client.query(
        `INSERT INTO regulatory_results (organization_id, calculation_id, overall_status, review_flags)
         VALUES ($1, $2, 'needs_verification', '[{"code":"REGULATORY_REVIEW_REQUIRED"}]'::jsonb)`,
        [contexte.org, id],
      )
      return id
    })

    const trace = await asUser(pool, contexte.user, async (client) => {
      const { rows } = await client.query(
        `SELECT c.engine_version_code, c.created_at, c.recipe_id, c.sds_version_ids,
                c.input_payload, c.input_digest, r.overall_status
         FROM regulatory_calculations c
         JOIN regulatory_results r ON r.calculation_id = c.id
         WHERE c.id = $1`,
        [contexte.calculation],
      )
      return rows[0]!
    })

    expect(trace.engine_version_code).toBe('NORMELYA_TEST_0000')
    expect(trace.created_at).toBeInstanceOf(Date)
    expect(trace.recipe_id).toBe(contexte.recipe)
    expect(trace.sds_version_ids).toEqual([contexte.sdsVersion])
    expect(trace.input_payload).toEqual({ ingredients: [{ percent: 100 }] })
    expect(trace.input_digest).toHaveLength(64)
    expect(trace.overall_status).toBe('needs_verification')
  })

  it('un calcul ne peut être ni modifié ni supprimé par le rôle applicatif', async () => {
    // Première barrière : aucune politique RLS n'autorise UPDATE ni DELETE.
    // La ligne est donc invisible à ces ordres et rien n'est modifié.
    const touchees = await asUser(pool, contexte.user, async (client) => {
      const majes = await client.query(
        `UPDATE regulatory_calculations SET market = 'CH' WHERE id = $1`,
        [contexte.calculation],
      )
      const suppressions = await client.query(
        `DELETE FROM regulatory_calculations WHERE id = $1`,
        [contexte.calculation],
      )
      return (majes.rowCount ?? 0) + (suppressions.rowCount ?? 0)
    })
    expect(touchees).toBe(0)

    const marche = await asUser(pool, contexte.user, async (client) => {
      const { rows } = await client.query(
        `SELECT market FROM regulatory_calculations WHERE id = $1`,
        [contexte.calculation],
      )
      return rows[0]!.market
    })
    expect(marche).toBe('FR')
  })

  it('la garde append-only refuse la modification même à un rôle privilégié', async () => {
    // Seconde barrière : le déclencheur, qui s'applique quel que soit le rôle.
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(`UPDATE regulatory_calculations SET market = 'CH' WHERE id = $1`, [
          contexte.calculation,
        ]),
      ),
    ).rejects.toThrow(/append-only/i)

    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(`DELETE FROM regulatory_calculations WHERE id = $1`, [contexte.calculation]),
      ),
    ).rejects.toThrow(/append-only/i)
  })

  it('un résultat ne peut pas être réécrit', async () => {
    const touchees = await asUser(pool, contexte.user, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE regulatory_results SET overall_status = 'completed' WHERE calculation_id = $1`,
        [contexte.calculation],
      )
      return rowCount ?? 0
    })
    expect(touchees).toBe(0)

    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(
          `UPDATE regulatory_results SET overall_status = 'completed' WHERE calculation_id = $1`,
          [contexte.calculation],
        ),
      ),
    ).rejects.toThrow(/append-only/i)
  })

  it('une version de FDS validée conserve son auteur et sa date', async () => {
    const version = await asUser(pool, contexte.user, async (client) => {
      const { rows } = await client.query(
        `SELECT status, validated_by, validated_at, validated_payload FROM sds_versions WHERE id = $1`,
        [contexte.sdsVersion],
      )
      return rows[0]!
    })
    expect(version.status).toBe('validated')
    expect(version.validated_by).toBe(contexte.user)
    expect(version.validated_at).toBeInstanceOf(Date)
  })

  it('une version de FDS ne peut pas être déclarée validée sans validation', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(
          `UPDATE sds_versions SET validated_by = NULL WHERE id = $1`,
          [contexte.sdsVersion],
        ),
      ),
    ).rejects.toThrow(/sds_versions_validation_complete/)
  })

  it('une version de produit verrouillée ne peut plus être modifiée', async () => {
    await seedAsOwner(databaseName, (client) =>
      client.query(
        `UPDATE product_versions SET is_locked = true, locked_at = now() WHERE id = $1`,
        [contexte.productVersion],
      ),
    )

    await expect(
      asUser(pool, contexte.user, async (client) => {
        const { rowCount } = await client.query(
          `UPDATE product_versions SET name_snapshot = 'Modifié' WHERE id = $1`,
          [contexte.productVersion],
        )
        if (rowCount === 0) throw new Error('aucune ligne modifiée')
      }),
    ).rejects.toThrow(/aucune ligne modifiée/)
  })

  it('une recette dont le total n’est pas 100 % est refusée par la base', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(
          `INSERT INTO recipes (organization_id, product_version_id, total_percent)
           VALUES ($1, $2, 99.9)`,
          [contexte.org, contexte.productVersion],
        ),
      ),
    ).rejects.toThrow(/recipes_total_is_100/)
  })

  it('un même document ne peut pas être déposé deux fois dans une organisation', async () => {
    await expect(
      seedAsOwner(databaseName, (client) =>
        client.query(
          `INSERT INTO documents (organization_id, kind, storage_key, original_filename, mime_type, byte_size, sha256)
           VALUES ($1, 'sds', 'demo/autre.pdf', 'autre.pdf', 'application/pdf', 2048, repeat('a', 64))`,
          [contexte.org],
        ),
      ),
    ).rejects.toThrow(/documents_org_sha256_idx/)
  })
})
