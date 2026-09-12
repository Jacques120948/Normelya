import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { VALIDATION_STATEMENT } from '@normelya/core'
import pg from 'pg'

/**
 * Isolation entre organisations, exécutée contre le service réel.
 *
 * La suite db/tests/rls.test.ts vérifie les mêmes propriétés sur une base
 * éphémère locale. Celle-ci les rejoue sur la base réellement servie, avec les
 * rôles réellement configurés chez l'hébergeur. C'est une vérification
 * différente : elle porte sur la configuration, pas sur le schéma.
 *
 * Deux chaînes de connexion sont attendues, toutes deux vers la MÊME base :
 *
 *   REAL_APP_DATABASE_URL      rôle applicatif, sans BYPASSRLS
 *   REAL_SERVICE_DATABASE_URL  rôle de confiance, avec BYPASSRLS
 *
 * À défaut, la suite est ignorée. Elle n'est jamais exécutée par défaut :
 * elle écrit dans une base réelle, et ne doit l'être que sur demande.
 *
 * Toutes les données créées portent le préfixe DEMO et sont supprimées à la
 * fin, y compris si un test échoue.
 */
const APP_URL = process.env.REAL_APP_DATABASE_URL ?? ''
const SERVICE_URL = process.env.REAL_SERVICE_DATABASE_URL ?? ''
const actif = APP_URL.length > 0 && SERVICE_URL.length > 0

const describeReel = actif ? describe : describe.skip

describeReel('isolation entre organisations — service réel', () => {
  let app: pg.Pool
  let service: pg.Client

  const marqueur = randomUUID().slice(0, 8)
  const atelierA = { org: '', user: '' }
  const atelierB = { org: '', user: '' }
  let intrus = ''

  /**
   * Exécute une requête dans les conditions exactes de l'application : une
   * transaction portant le contexte utilisateur, posé par SET LOCAL.
   */
  async function commeUtilisateur<T>(
    userId: string | null,
    run: (client: pg.PoolClient) => Promise<T>,
    organizationId?: string,
  ): Promise<T> {
    const client = await app.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId ?? ''])
      await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
        organizationId ?? '',
      ])
      const valeur = await run(client)
      await client.query('COMMIT')
      return valeur
    } catch (erreur) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw erreur
    } finally {
      client.release()
    }
  }

  beforeAll(async () => {
    app = new pg.Pool({ connectionString: APP_URL, max: 4 })
    service = new pg.Client({ connectionString: SERVICE_URL })
    await service.connect()

    const creerUtilisateur = async (etiquette: string) => {
      const { rows } = await service.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email, email_verified_at)
         VALUES ('test', $1, $2, now()) RETURNING id`,
        [`demo-${marqueur}-${etiquette}`, `demo-${marqueur}-${etiquette}@exemple.test`],
      )
      return rows[0]!.id
    }
    const creerOrganisation = async (nom: string) => {
      const { rows } = await service.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ($1, 'FR') RETURNING id`,
        [nom],
      )
      return rows[0]!.id
    }

    atelierA.user = await creerUtilisateur('a')
    atelierB.user = await creerUtilisateur('b')
    intrus = await creerUtilisateur('intrus')
    atelierA.org = await creerOrganisation(`DEMO Atelier A ${marqueur}`)
    atelierB.org = await creerOrganisation(`DEMO Atelier B ${marqueur}`)

    await service.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`,
      [atelierA.org, atelierA.user, atelierB.org, atelierB.user],
    )

    await service.query(
      `INSERT INTO raw_materials (organization_id, name, category, created_by)
       VALUES ($1, $2, 'wax', $3), ($4, $5, 'fragrance', $6)`,
      [
        atelierA.org,
        `DEMO Cire ${marqueur}`,
        atelierA.user,
        atelierB.org,
        `DEMO Parfum secret ${marqueur}`,
        atelierB.user,
      ],
    )
  }, 120_000)

  /**
   * Nettoyage systématique, y compris après un échec.
   *
   * Les organisations emportent en cascade membres, matières et attestations.
   * Or les attestations sont append-only : leur suppression n'est permise que
   * sous le mode effacement, celui-là même qu'emploie la purge réglementaire.
   * Sans lui, la suppression de l'organisation échoue et les données de test
   * restent dans une base réelle.
   *
   * Aucune erreur n'est avalée : un nettoyage incomplet doit être visible,
   * sans quoi il se répète silencieusement à chaque exécution.
   */
  afterAll(async () => {
    const echecs: string[] = []

    if (service) {
      try {
        await service.query('BEGIN')
        await service.query(`SET LOCAL app.erasure_mode = 'on'`)
        for (const org of [atelierA.org, atelierB.org]) {
          if (org) await service.query('DELETE FROM organizations WHERE id = $1', [org])
        }
        for (const user of [atelierA.user, atelierB.user, intrus]) {
          if (user) await service.query('DELETE FROM users WHERE id = $1', [user])
        }
        await service.query('COMMIT')
      } catch (erreur) {
        await service.query('ROLLBACK').catch(() => undefined)
        echecs.push(erreur instanceof Error ? erreur.message : String(erreur))
      }
      await service.end().catch(() => undefined)
    }
    if (app) await app.end().catch(() => undefined)

    if (echecs.length > 0) {
      throw new Error(
        `Nettoyage incomplet dans la base réelle (marqueur ${marqueur}) : ${echecs.join(' ; ')}`,
      )
    }
  })

  /**
   * Vérification préalable, et la plus importante de toutes.
   *
   * Si le rôle applicatif possédait BYPASSRLS, tous les tests suivants
   * passeraient en apparence tout en ne vérifiant rien : les politiques
   * seraient simplement contournées. Cette assertion garantit que la suite a
   * un sens.
   */
  it('le rôle applicatif ne possède pas BYPASSRLS', async () => {
    const { rows } = await app.query<{ role: string; bypass: boolean }>(
      `SELECT current_user AS role, rolbypassrls AS bypass
       FROM pg_roles WHERE rolname = current_user`,
    )
    expect(rows[0]?.bypass).toBe(false)
  })

  it('les deux connexions visent bien la même base', async () => {
    const cote = await app.query<{ base: string }>(
      'SELECT current_database() AS base',
    )
    const autre = await service.query<{ base: string }>('SELECT current_database() AS base')
    expect(cote.rows[0]?.base).toBe(autre.rows[0]?.base)
  })

  it('l’isolation est imposée même au propriétaire des tables', async () => {
    // ENABLE seul laisse passer le propriétaire des tables. FORCE est ce qui
    // ferme cette porte. Sans lui, l'isolation dépendrait de qui possède le
    // schéma chez l'hébergeur.
    const { rows } = await service.query<{ relname: string }>(
      `SELECT relname FROM pg_class
       WHERE relnamespace = 'public'::regnamespace
         AND relkind = 'r'
         AND relrowsecurity = true
         AND relforcerowsecurity = false
       ORDER BY relname`,
    )
    expect(rows.map((ligne) => ligne.relname)).toEqual([])
  })

  it('un membre ne voit que les matières de son organisation', async () => {
    const vueA = await commeUtilisateur(atelierA.user, async (client) => {
      const { rows } = await client.query<{ name: string }>(
        'SELECT name FROM raw_materials ORDER BY name',
      )
      return rows.map((ligne) => ligne.name)
    })
    expect(vueA).toEqual([`DEMO Cire ${marqueur}`])

    const vueB = await commeUtilisateur(atelierB.user, async (client) => {
      const { rows } = await client.query<{ name: string }>(
        'SELECT name FROM raw_materials ORDER BY name',
      )
      return rows.map((ligne) => ligne.name)
    })
    expect(vueB).toEqual([`DEMO Parfum secret ${marqueur}`])
  })

  it('un utilisateur sans organisation ne voit rien', async () => {
    const vue = await commeUtilisateur(intrus, async (client) => {
      const { rows } = await client.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM raw_materials',
      )
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })

  it('une requête sans contexte utilisateur ne renvoie rien', async () => {
    const vue = await commeUtilisateur(null, async (client) => {
      const { rows } = await client.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM raw_materials',
      )
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })

  it('cibler explicitement l’organisation d’autrui ne contourne pas l’isolation', async () => {
    const vue = await commeUtilisateur(atelierA.user, async (client) => {
      const { rows } = await client.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM raw_materials WHERE organization_id = $1',
        [atelierB.org],
      )
      return rows[0]!.total
    })
    expect(vue).toBe(0)
  })

  it('écrire dans l’organisation d’autrui est refusé', async () => {
    await expect(
      commeUtilisateur(atelierA.user, async (client) => {
        await client.query(
          `INSERT INTO raw_materials (organization_id, name, category)
           VALUES ($1, $2, 'other')`,
          [atelierB.org, `DEMO Injection ${marqueur}`],
        )
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('modifier ou supprimer la matière d’autrui reste sans effet', async () => {
    const modifiees = await commeUtilisateur(atelierA.user, async (client) => {
      const resultat = await client.query(
        `UPDATE raw_materials SET name = 'DEMO Renommée' WHERE organization_id = $1`,
        [atelierB.org],
      )
      return resultat.rowCount
    })
    expect(modifiees).toBe(0)

    const supprimees = await commeUtilisateur(atelierA.user, async (client) => {
      const resultat = await client.query('DELETE FROM raw_materials WHERE organization_id = $1', [
        atelierB.org,
      ])
      return resultat.rowCount
    })
    expect(supprimees).toBe(0)

    // La matière de B est toujours là, intacte.
    const { rows } = await service.query<{ name: string }>(
      'SELECT name FROM raw_materials WHERE organization_id = $1',
      [atelierB.org],
    )
    expect(rows.map((ligne) => ligne.name)).toEqual([`DEMO Parfum secret ${marqueur}`])
  })

  it('les organisations elles-mêmes sont isolées', async () => {
    const vue = await commeUtilisateur(atelierA.user, async (client) => {
      const { rows } = await client.query<{ name: string }>('SELECT name FROM organizations')
      return rows.map((ligne) => ligne.name)
    })
    expect(vue).toEqual([`DEMO Atelier A ${marqueur}`])
  })

  it('le journal des paiements est inaccessible au rôle applicatif', async () => {
    await expect(
      commeUtilisateur(atelierA.user, async (client) => {
        await client.query('SELECT * FROM payment_events')
      }),
    ).rejects.toThrow(/permission denied/i)
  })

  it('un utilisateur ne peut pas forger une trace d’audit', async () => {
    await expect(
      commeUtilisateur(atelierA.user, async (client) => {
        await client.query(
          `INSERT INTO audit_logs (organization_id, action, entity_type)
           VALUES ($1, 'faux', 'test')`,
          [atelierA.org],
        )
      }),
    ).rejects.toThrow(/permission denied/i)
  })

  /**
   * Les attestations sont la principale protection en cas de litige. Deux
   * barrières distinctes les protègent, et chacune doit être vérifiée pour
   * elle-même :
   *
   *   - pour le rôle applicatif, aucune politique UPDATE ni DELETE n'existe :
   *     la ligne n'est même pas visible pour être modifiée, l'ordre ne touche
   *     rien et ne lève rien ;
   *   - pour tout rôle qui franchirait cette première barrière, un déclencheur
   *     refuse l'écriture.
   *
   * Vérifier seulement la première laisserait croire que le déclencheur
   * fonctionne alors qu'il n'aurait jamais été atteint.
   */
  it('une attestation est hors d’atteinte du rôle applicatif', async () => {
    const id = await creerAttestation()

    const modifiees = await commeUtilisateur(atelierA.user, async (client) => {
      const resultat = await client.query(
        `UPDATE validation_attestations SET data_hash = repeat('b', 64) WHERE id = $1`,
        [id],
      )
      return resultat.rowCount
    })
    expect(modifiees).toBe(0)

    const supprimees = await commeUtilisateur(atelierA.user, async (client) => {
      const resultat = await client.query('DELETE FROM validation_attestations WHERE id = $1', [id])
      return resultat.rowCount
    })
    expect(supprimees).toBe(0)

    // La ligne est intacte : l'empreinte d'origine n'a pas bougé.
    const { rows } = await service.query<{ data_hash: string }>(
      'SELECT data_hash FROM validation_attestations WHERE id = $1',
      [id],
    )
    expect(rows[0]?.data_hash).toBe('a'.repeat(64))
  })

  it('une attestation résiste au rôle de confiance lui-même', async () => {
    const id = await creerAttestation()

    // Ce rôle contourne les politiques : c'est ici que le déclencheur
    // append-only est réellement mis à l'épreuve.
    await expect(
      service.query(`UPDATE validation_attestations SET data_hash = repeat('b', 64) WHERE id = $1`, [
        id,
      ]),
    ).rejects.toThrow()

    await expect(
      service.query('DELETE FROM validation_attestations WHERE id = $1', [id]),
    ).rejects.toThrow()
  })

  /** Attestation minimale valide, rattachée à l'atelier A. */
  async function creerAttestation(): Promise<string> {
    const { rows } = await service.query<{ id: string }>(
      `INSERT INTO validation_attestations
         (organization_id, user_id, scope, entity_type, entity_id, data_hash,
          statement_text, attested_by_name, attested_by_email)
       VALUES ($1, $2, 'recipe', 'product_version', gen_random_uuid(), repeat('a', 64),
               $3, 'DEMO Camille', $4)
       RETURNING id`,
      [atelierA.org, atelierA.user, VALIDATION_STATEMENT, `demo-${marqueur}@exemple.test`],
    )
    return rows[0]!.id
  }
})
