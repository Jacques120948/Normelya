import { z } from 'zod'

/**
 * Variables d'environnement.
 *
 * Règle absolue : aucun secret ne porte le préfixe NEXT_PUBLIC_. Tout ce qui est
 * préfixé ainsi est envoyé au navigateur. Un contrôle automatisé (voir
 * scripts/verifier-secrets.mjs) vérifie qu'aucune clé de service ne fuit.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Rôle applicatif : soumis aux politiques RLS, sans BYPASSRLS.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis.'),
  // Rôle de service : réservé aux écritures de confiance (création de compte,
  // journal d'audit, webhooks de paiement). À défaut, DATABASE_URL est réutilisé,
  // ce qui n'est acceptable qu'en développement.
  SERVICE_DATABASE_URL: z.string().optional(),

  // Choix des adaptateurs. Les implémentations locales sont réservées au
  // développement et refusées en production.
  AUTH_PROVIDER: z.enum(['supabase', 'local']).default('supabase'),
  STORAGE_PROVIDER: z.enum(['supabase', 'local']).default('supabase'),
  LOCAL_STORAGE_DIR: z.string().default('.tmp/documents'),

  // Fournisseur d'authentification et de stockage (adaptateur Supabase).
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('normelya-documents'),

  // Courrier transactionnel.
  MAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Normelya <bonjour@normelya.com>'),

  // Assistance par IA : désactivée par défaut, y compris en développement.
  AI_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
})

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('Normelya'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | null = null

/** Lit et valide l'environnement serveur. Ne doit jamais être appelé côté client. */
export function serverEnv(): ServerEnv {
  if (cached) return cached
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join('\n')
    throw new Error(`Configuration invalide :\n${details}`)
  }
  if (parsed.data.NODE_ENV === 'production') {
    if (parsed.data.AUTH_PROVIDER === 'local' || parsed.data.STORAGE_PROVIDER === 'local') {
      throw new Error(
        'Les adaptateurs locaux sont réservés au développement et ne peuvent pas servir en production.',
      )
    }
  }

  cached = parsed.data
  return cached
}

export function clientEnv() {
  return clientSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}

export function isProduction(): boolean {
  return serverEnv().NODE_ENV === 'production'
}

/** Remet l'environnement en cache à zéro. Réservé aux tests. */
export function resetEnvCache(): void {
  cached = null
}
