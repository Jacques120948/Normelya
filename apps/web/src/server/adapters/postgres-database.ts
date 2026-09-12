import pg from 'pg'
import type {
  Database,
  DatabaseClient,
  DatabaseContext,
  SqlParameter,
} from '../ports/database'

/**
 * Adaptateur PostgreSQL.
 *
 * Deux garanties importantes :
 *
 * 1. `withContext` pose `app.current_user_id` et `app.current_organization_id`
 *    en SET LOCAL, c'est-à-dire pour la seule durée de la transaction. Les
 *    politiques RLS s'appliquent donc à chaque requête, y compris si le code
 *    métier oublie un filtre sur organization_id.
 *
 * 2. Le rôle de connexion applicatif ne possède pas BYPASSRLS. Un défaut de
 *    code ne peut pas faire fuiter les données d'une autre organisation.
 */
export class PostgresDatabase implements Database {
  private readonly pool: pg.Pool

  constructor(connectionString: string, options?: { max?: number }) {
    this.pool = new pg.Pool({
      connectionString,
      max: options?.max ?? 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Une requête ne doit jamais bloquer une connexion indéfiniment.
      statement_timeout: 15_000,
    })
  }

  async query<T = Record<string, unknown>>(sql: string, params: SqlParameter[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params as unknown[])
    return result.rows as T[]
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: SqlParameter[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows[0] ?? null
  }

  async transaction<T>(run: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return this.runInTransaction(null, run)
  }

  async withContext<T>(
    context: DatabaseContext,
    run: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    if (!context.userId) {
      throw new Error('withContext exige un identifiant utilisateur.')
    }
    return this.runInTransaction(context, run)
  }

  private async runInTransaction<T>(
    context: DatabaseContext | null,
    run: (client: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    const connection = await this.pool.connect()
    try {
      await connection.query('BEGIN')
      if (context) {
        // SET LOCAL : le contexte disparaît avec la transaction, il ne peut pas
        // fuiter vers la requête suivante servie par la même connexion.
        await connection.query(`SELECT set_config('app.current_user_id', $1, true)`, [
          context.userId,
        ])
        await connection.query(`SELECT set_config('app.current_organization_id', $1, true)`, [
          context.organizationId ?? '',
        ])
      }

      const client: DatabaseClient = {
        query: async <R>(sql: string, params: SqlParameter[] = []) => {
          const result = await connection.query(sql, params as unknown[])
          return result.rows as R[]
        },
        queryOne: async <R>(sql: string, params: SqlParameter[] = []) => {
          const result = await connection.query(sql, params as unknown[])
          return (result.rows[0] as R | undefined) ?? null
        },
      }

      const value = await run(client)
      await connection.query('COMMIT')
      return value
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      connection.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
