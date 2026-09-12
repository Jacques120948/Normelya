import { serverEnv } from './env'
import { PostgresDatabase } from './adapters/postgres-database'
import { SupabaseAuthProvider } from './adapters/supabase-auth'
import { SupabaseFileStorage } from './adapters/supabase-storage'
import { ConsoleMailSender, ResendMailSender } from './adapters/mail'
import { InMemoryRateLimiter } from './security/rate-limit'
import type { AuthProvider } from './ports/auth'
import type { Database } from './ports/database'
import type { FileStorage } from './ports/storage'
import type { MailSender } from './ports/mail'
import type { RateLimiter } from './security/rate-limit'

/**
 * Composition des dépendances.
 *
 * C'est le seul endroit du code applicatif qui connaît les implémentations
 * concrètes. Changer de fournisseur se fait ici, sans toucher aux services.
 */
export type Services = {
  /** Connexion applicative : toutes les politiques RLS s'appliquent. */
  db: Database
  /** Connexion de service : écritures de confiance uniquement. */
  serviceDb: Database
  auth: AuthProvider
  storage: FileStorage
  mail: MailSender
  rateLimiter: RateLimiter
}

let instance: Services | null = null

export function services(): Services {
  if (instance) return instance
  const env = serverEnv()

  const db = new PostgresDatabase(env.DATABASE_URL)
  const serviceDb = env.SERVICE_DATABASE_URL
    ? new PostgresDatabase(env.SERVICE_DATABASE_URL, { max: 4 })
    : db

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_ANON_KEY sont requis pour l'authentification. " +
        'Voir .env.example.',
    )
  }

  const auth = new SupabaseAuthProvider({
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  })

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY est requis pour le stockage privé des documents.')
  }

  const storage = new SupabaseFileStorage({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_STORAGE_BUCKET,
  })

  const mail: MailSender =
    env.MAIL_PROVIDER === 'resend' && env.RESEND_API_KEY
      ? new ResendMailSender({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM })
      : new ConsoleMailSender()

  instance = { db, serviceDb, auth, storage, mail, rateLimiter: new InMemoryRateLimiter() }
  return instance
}

/** Injecte des implémentations de substitution. Réservé aux tests. */
export function setServices(replacement: Services | null): void {
  instance = replacement
}
