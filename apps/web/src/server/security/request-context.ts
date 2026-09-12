import { AppError, type Locale, type OrganizationRole, type PlanCode } from '@normelya/core'
import type { RequestContext } from '@normelya/core'
import type { AuthProvider } from '../ports/auth'
import type { Database } from '../ports/database'

/**
 * Résolution du contexte de requête.
 *
 * Ce contexte est la seule autorité sur « qui fait quoi ». Il est construit
 * exclusivement côté serveur, à partir du jeton de session et de la base : aucune
 * de ses valeurs n'est acceptée depuis le client, pas même l'identifiant
 * d'organisation, qui n'est qu'une préférence d'affichage revérifiée ici.
 */

export type ResolvedUser = {
  userId: string
  email: string
  emailVerified: boolean
  firstName: string | null
  lastName: string | null
  locale: Locale
  isPlatformAdmin: boolean
}

export type SessionState =
  | { kind: 'anonymous' }
  | { kind: 'unverified'; user: ResolvedUser }
  | { kind: 'needs_onboarding'; user: ResolvedUser }
  | { kind: 'ready'; user: ResolvedUser; context: RequestContext }

type MembershipRow = {
  organization_id: string
  role: OrganizationRole
  onboarding_completed_at: Date | null
  default_locale: Locale
  plan_code: PlanCode | null
}

export async function resolveSession(deps: {
  auth: AuthProvider
  db: Database
  accessToken: string | null
  preferredOrganizationId: string | null
}): Promise<SessionState> {
  if (!deps.accessToken) return { kind: 'anonymous' }

  const authUser = await deps.auth.getUser(deps.accessToken)
  if (!authUser) return { kind: 'anonymous' }

  // La fiche applicative est la référence : elle porte le profil, la langue et
  // le statut d'administrateur de plateforme, jamais lus depuis le jeton.
  const row = await deps.db.queryOne<{
    id: string
    email: string
    email_verified_at: Date | null
    first_name: string | null
    last_name: string | null
    locale: Locale
    is_platform_admin: boolean
  }>(
    `SELECT id, email, email_verified_at, first_name, last_name, locale, is_platform_admin
     FROM users
     WHERE auth_provider = $1 AND auth_subject = $2 AND deleted_at IS NULL`,
    [deps.auth.name, authUser.subject],
  )

  if (!row) return { kind: 'anonymous' }

  const user: ResolvedUser = {
    userId: row.id,
    email: row.email,
    emailVerified: row.email_verified_at !== null || authUser.emailVerified,
    firstName: row.first_name,
    lastName: row.last_name,
    locale: row.locale,
    isPlatformAdmin: row.is_platform_admin,
  }

  if (!user.emailVerified) return { kind: 'unverified', user }

  const memberships = await deps.db.query<MembershipRow>(
    `SELECT m.organization_id, m.role, o.onboarding_completed_at, o.default_locale,
            p.code AS plan_code
     FROM organization_members m
     JOIN organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
     LEFT JOIN subscriptions s
            ON s.organization_id = o.id
           AND s.status IN ('trialing', 'active', 'past_due')
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE m.user_id = $1 AND m.accepted_at IS NOT NULL
     ORDER BY m.created_at ASC`,
    [user.userId],
  )

  if (memberships.length === 0) return { kind: 'needs_onboarding', user }

  const selected =
    memberships.find((m) => m.organization_id === deps.preferredOrganizationId) ?? memberships[0]!

  if (selected.onboarding_completed_at === null) {
    return { kind: 'needs_onboarding', user }
  }

  return {
    kind: 'ready',
    user,
    context: {
      userId: user.userId,
      organizationId: selected.organization_id,
      role: selected.role,
      // Sans abonnement enregistré, l'organisation est sur l'offre gratuite.
      plan: selected.plan_code ?? 'free',
      locale: user.locale,
      isPlatformAdmin: user.isPlatformAdmin,
    },
  }
}

/** Exige une session complète. Lève une erreur applicative sinon. */
export function requireContext(session: SessionState): RequestContext {
  if (session.kind !== 'ready') throw AppError.unauthenticated()
  return session.context
}

/** Exige un rôle minimum dans l'organisation courante. */
export function requireRole(context: RequestContext, required: OrganizationRole): void {
  const rank: Record<OrganizationRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 }
  if (rank[context.role] < rank[required]) {
    throw AppError.forbidden("Votre rôle ne permet pas cette action.")
  }
}
