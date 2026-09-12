import { redirect } from 'next/navigation'
import type { RequestContext } from '@normelya/core'
import { services } from '../container'
import { readAccessToken, readActiveOrganizationId } from './session'
import { resolveSession, type ResolvedUser, type SessionState } from './request-context'

/**
 * Gardes d'accès des pages serveur.
 *
 * Chaque page de l'espace connecté commence par l'une de ces fonctions. Elles
 * résolvent la session en base à chaque requête : aucune information de droit
 * n'est mise en cache ni lue depuis le client.
 */

export async function chargerSession(): Promise<SessionState> {
  const { auth, serviceDb } = services()
  return resolveSession({
    auth,
    serviceDb,
    accessToken: await readAccessToken(),
    preferredOrganizationId: await readActiveOrganizationId(),
  })
}

/** Exige une session complète : compte vérifié et atelier configuré. */
export async function exigerAtelier(): Promise<{
  user: ResolvedUser
  context: RequestContext
}> {
  const session = await chargerSession()
  switch (session.kind) {
    case 'anonymous':
      redirect('/connexion')
    // eslint-disable-next-line no-fallthrough
    case 'unverified':
      redirect('/inscription?envoye=1')
    // eslint-disable-next-line no-fallthrough
    case 'needs_onboarding':
      redirect('/bienvenue')
    // eslint-disable-next-line no-fallthrough
    case 'ready':
      return { user: session.user, context: session.context }
  }
}

/** Exige un utilisateur connecté dont l'atelier reste à configurer. */
export async function exigerOnboarding(): Promise<ResolvedUser> {
  const session = await chargerSession()
  switch (session.kind) {
    case 'anonymous':
      redirect('/connexion')
    // eslint-disable-next-line no-fallthrough
    case 'unverified':
      redirect('/inscription?envoye=1')
    // eslint-disable-next-line no-fallthrough
    case 'ready':
      redirect('/tableau-de-bord')
    // eslint-disable-next-line no-fallthrough
    case 'needs_onboarding':
      return session.user
  }
}
