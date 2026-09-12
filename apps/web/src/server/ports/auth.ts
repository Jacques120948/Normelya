import type { Result } from '@normelya/core'

/**
 * Port d'authentification.
 *
 * Normelya ne stocke aucun mot de passe : l'authentification est déléguée à un
 * fournisseur. Changer de fournisseur revient à écrire une implémentation de
 * cette interface. Voir docs/adr/0002-supabase-derriere-des-ports.md
 */

export type AuthUser = {
  /** Identifiant chez le fournisseur d'authentification. */
  subject: string
  email: string
  emailVerified: boolean
}

export type AuthError =
  | { kind: 'invalid_credentials' }
  | { kind: 'email_already_used' }
  | { kind: 'weak_password'; message: string }
  | { kind: 'invalid_token' }
  | { kind: 'rate_limited' }
  | { kind: 'provider_unavailable'; message: string }

export interface AuthProvider {
  readonly name: string

  signUp(input: {
    email: string
    password: string
    redirectTo: string
  }): Promise<Result<AuthUser, AuthError>>

  signIn(input: {
    email: string
    password: string
  }): Promise<Result<{ user: AuthUser; accessToken: string; refreshToken: string }, AuthError>>

  signOut(accessToken: string): Promise<void>

  /** Relance l'e-mail de vérification. */
  resendVerification(input: { email: string; redirectTo: string }): Promise<Result<void, AuthError>>

  requestPasswordReset(input: {
    email: string
    redirectTo: string
  }): Promise<Result<void, AuthError>>

  resetPassword(input: { token: string; password: string }): Promise<Result<void, AuthError>>

  /** Résout l'utilisateur à partir du jeton d'accès. Retourne null si invalide. */
  getUser(accessToken: string): Promise<AuthUser | null>

  /** Suppression définitive chez le fournisseur (effacement RGPD). */
  deleteUser(subject: string): Promise<Result<void, AuthError>>
}
