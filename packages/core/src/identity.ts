export type Uuid = string

export const ORGANIZATION_ROLES = ['owner', 'admin', 'member', 'viewer'] as const
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

/** Hiérarchie des rôles : un rôle donne les droits de tous les rôles inférieurs. */
const ROLE_RANK: Record<OrganizationRole, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
}

export function roleAtLeast(role: OrganizationRole, required: OrganizationRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required]
}

export type Locale = 'fr' | 'de' | 'it' | 'en'
export const SUPPORTED_LOCALES: readonly Locale[] = ['fr', 'de', 'it', 'en']
/** Seule langue livrée en V1 ; les autres sont préparées mais pas activées. */
export const DEFAULT_LOCALE: Locale = 'fr'
export const ENABLED_LOCALES: readonly Locale[] = ['fr']

/**
 * Contexte d'une requête authentifiée. Toujours construit côté serveur à partir
 * de la session : aucune de ces valeurs n'est acceptée depuis le client.
 */
export type RequestContext = {
  userId: Uuid
  organizationId: Uuid
  role: OrganizationRole
  plan: PlanCode
  locale: Locale
  isPlatformAdmin: boolean
}

import type { PlanCode } from './plans.js'
