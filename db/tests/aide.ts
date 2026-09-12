import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/**
 * URL d'un PostgreSQL de test. Sans cette variable, les tests d'intégration
 * base de données sont ignorés : la suite unitaire reste exécutable partout.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? ''
export const hasTestDatabase = TEST_DATABASE_URL.length > 0

/** Rôle applicatif : non propriétaire, sans BYPASSRLS. */
export const APP_ROLE = 'normelya_app_test'

export async function applyMigrations(client: pg.Client): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    await client.query(sql)
  }
}

/**
 * Crée une base éphémère, y applique les migrations et rend un pool connecté
 * avec le rôle applicatif — celui qui subit réellement les politiques RLS.
 */
export async function createTestDatabase(): Promise<{
  pool: pg.Pool
  dropDatabase: () => Promise<void>
  databaseName: string
}> {
  const databaseName = `normelya_t_${randomUUID().replace(/-/g, '').slice(0, 16)}`
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${databaseName}`)
  await admin.end()

  const target = TEST_DATABASE_URL.replace(/\/[^/?]*(\?|$)/, `/${databaseName}$1`)

  const owner = new pg.Client({ connectionString: target })
  await owner.connect()
  await applyMigrations(owner)

  // Rôle applicatif : les politiques RLS doivent s'appliquer pleinement.
  await owner.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} LOGIN NOBYPASSRLS PASSWORD 'test';
      END IF;
    END
    $$;
  `)
  await owner.query(`GRANT USAGE ON SCHEMA public, app TO ${APP_ROLE}`)
  await owner.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`,
  )
  await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO ${APP_ROLE}`)
  await owner.query(`REVOKE ALL ON TABLE payment_events FROM ${APP_ROLE}`)
  await owner.query(`REVOKE INSERT, UPDATE, DELETE ON TABLE audit_logs FROM ${APP_ROLE}`)
  await owner.end()

  const appUrl = target.replace(/^postgres(ql)?:\/\/[^@]*@/, `postgres://${APP_ROLE}:test@`)
  const pool = new pg.Pool({ connectionString: appUrl, max: 4 })

  return {
    pool,
    databaseName,
    dropDatabase: async () => {
      await pool.end()
      const cleanup = new pg.Client({ connectionString: TEST_DATABASE_URL })
      await cleanup.connect()
      await cleanup.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
        [databaseName],
      )
      await cleanup.query(`DROP DATABASE IF EXISTS ${databaseName}`)
      await cleanup.end()
    },
  }
}

/**
 * Exécute une fonction dans une transaction portant le contexte d'un utilisateur,
 * exactement comme le fait la couche d'accès aux données de l'application.
 */
export async function asUser<T>(
  pool: pg.Pool,
  userId: string | null,
  run: (client: pg.PoolClient) => Promise<T>,
  organizationId?: string,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId ?? ''])
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
      organizationId ?? '',
    ])
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Insertion de données de référence avec le rôle propriétaire (hors RLS). */
export async function seedAsOwner<T>(
  databaseName: string,
  run: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const target = TEST_DATABASE_URL.replace(/\/[^/?]*(\?|$)/, `/${databaseName}$1`)
  const client = new pg.Client({ connectionString: target })
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end()
  }
}
