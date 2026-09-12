import { cookies } from 'next/headers'

/**
 * Gestion des cookies de session.
 *
 * Les cookies sont HttpOnly (inaccessibles au JavaScript de la page), Secure en
 * production, et SameSite=Lax — ce qui bloque l'envoi du cookie sur une requête
 * POST venue d'un autre site, donc l'essentiel des attaques CSRF.
 */

const ACCESS_TOKEN_COOKIE = 'normelya_at'
const REFRESH_TOKEN_COOKIE = 'normelya_rt'
const ORGANIZATION_COOKIE = 'normelya_org'

function baseOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
}

export async function setSessionCookies(tokens: {
  accessToken: string
  refreshToken: string
}): Promise<void> {
  const store = await cookies()
  store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: 60 * 60, // une heure
  })
  store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: 60 * 60 * 24 * 30, // trente jours
  })
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies()
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ORGANIZATION_COOKIE]) {
    store.delete(name)
  }
}

export async function readAccessToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null
}

export async function readRefreshToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(REFRESH_TOKEN_COOKIE)?.value ?? null
}

/**
 * Organisation active.
 *
 * Valeur de confort uniquement : elle ne donne aucun droit. L'appartenance est
 * revérifiée en base à chaque requête, et les politiques RLS s'appliquent de
 * toute façon.
 */
export async function readActiveOrganizationId(): Promise<string | null> {
  const store = await cookies()
  return store.get(ORGANIZATION_COOKIE)?.value ?? null
}

export async function setActiveOrganizationId(organizationId: string): Promise<void> {
  const store = await cookies()
  store.set(ORGANIZATION_COOKIE, organizationId, {
    ...baseOptions(),
    maxAge: 60 * 60 * 24 * 90,
  })
}
