/**
 * Port d'accès aux données.
 *
 * Le code métier ne connaît que cette interface. Aucun service n'importe de
 * pilote PostgreSQL ni de client Supabase.
 *
 * Toute lecture ou écriture de données client passe par `withContext`, qui pose
 * le contexte utilisateur dans la transaction PostgreSQL. Les politiques RLS
 * s'appliquent alors comme en production, y compris si le code applicatif
 * oublie un filtre : c'est la seconde barrière de l'isolation.
 */

export type SqlParameter = string | number | boolean | Date | null | undefined | string[] | object

export interface DatabaseClient {
  query<T = Record<string, unknown>>(sql: string, params?: SqlParameter[]): Promise<T[]>
  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParameter[]): Promise<T | null>
}

export type DatabaseContext = {
  userId: string
  /** Restreint la visibilité à cette seule organisation. */
  organizationId?: string
}

export interface Database extends DatabaseClient {
  /** Transaction sans contexte utilisateur : réservée aux tâches de service. */
  transaction<T>(run: (client: DatabaseClient) => Promise<T>): Promise<T>

  /** Transaction portant le contexte d'un utilisateur. Voie normale. */
  withContext<T>(
    context: DatabaseContext,
    run: (client: DatabaseClient) => Promise<T>,
  ): Promise<T>

  close(): Promise<void>
}
