import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { err, ok, type Result } from '@normelya/core'
import type { AuthError, AuthProvider, AuthUser } from '../ports/auth'

/**
 * Adaptateur d'authentification Supabase.
 *
 * Toute la connaissance de Supabase est confinée ici. Le code métier ne connaît
 * que le port AuthProvider.
 *
 * Les messages d'erreur renvoyés à l'utilisateur ne distinguent jamais
 * « e-mail inconnu » de « mot de passe incorrect » : cela permettrait d'énumérer
 * les comptes existants.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name = 'supabase'
  private readonly publicClient: SupabaseClient
  private readonly adminClient: SupabaseClient | null

  constructor(config: { url: string; anonKey: string; serviceRoleKey?: string }) {
    this.publicClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    this.adminClient = config.serviceRoleKey
      ? createClient(config.url, config.serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null
  }

  async signUp(input: {
    email: string
    password: string
    redirectTo: string
  }): Promise<Result<AuthUser, AuthError>> {
    const { data, error } = await this.publicClient.auth.signUp({
      email: input.email,
      password: input.password,
      options: { emailRedirectTo: input.redirectTo },
    })

    if (error) return err(this.translate(error.message, error.status))
    if (!data.user) return err({ kind: 'provider_unavailable', message: 'Réponse incomplète.' })

    return ok(this.toAuthUser(data.user.id, data.user.email, data.user.email_confirmed_at))
  }

  async signIn(input: { email: string; password: string }) {
    const { data, error } = await this.publicClient.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error || !data.user || !data.session) {
      return err<AuthError>({ kind: 'invalid_credentials' })
    }

    return ok({
      user: this.toAuthUser(data.user.id, data.user.email, data.user.email_confirmed_at),
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    })
  }

  async signOut(accessToken: string): Promise<void> {
    await this.publicClient.auth.admin
      .signOut(accessToken)
      .catch(() => undefined)
  }

  async resendVerification(input: {
    email: string
    redirectTo: string
  }): Promise<Result<void, AuthError>> {
    const { error } = await this.publicClient.auth.resend({
      type: 'signup',
      email: input.email,
      options: { emailRedirectTo: input.redirectTo },
    })
    if (error) return err(this.translate(error.message, error.status))
    return ok(undefined)
  }

  async requestPasswordReset(input: {
    email: string
    redirectTo: string
  }): Promise<Result<void, AuthError>> {
    const { error } = await this.publicClient.auth.resetPasswordForEmail(input.email, {
      redirectTo: input.redirectTo,
    })
    // Une adresse inconnue ne doit pas être distinguable d'une adresse connue.
    if (error && error.status !== 400) return err(this.translate(error.message, error.status))
    return ok(undefined)
  }

  async resetPassword(input: {
    token: string
    password: string
  }): Promise<Result<void, AuthError>> {
    const { error: verifyError } = await this.publicClient.auth.verifyOtp({
      token_hash: input.token,
      type: 'recovery',
    })
    if (verifyError) return err<AuthError>({ kind: 'invalid_token' })

    const { error } = await this.publicClient.auth.updateUser({ password: input.password })
    if (error) return err(this.translate(error.message, error.status))
    return ok(undefined)
  }

  async getUser(accessToken: string): Promise<AuthUser | null> {
    const { data, error } = await this.publicClient.auth.getUser(accessToken)
    if (error || !data.user) return null
    return this.toAuthUser(data.user.id, data.user.email, data.user.email_confirmed_at)
  }

  async deleteUser(subject: string): Promise<Result<void, AuthError>> {
    if (!this.adminClient) {
      return err<AuthError>({
        kind: 'provider_unavailable',
        message: 'Suppression impossible : clé de service absente.',
      })
    }
    const { error } = await this.adminClient.auth.admin.deleteUser(subject)
    if (error) return err(this.translate(error.message, error.status))
    return ok(undefined)
  }

  private toAuthUser(
    id: string,
    email: string | undefined,
    confirmedAt: string | undefined | null,
  ): AuthUser {
    return {
      subject: id,
      email: email ?? '',
      emailVerified: Boolean(confirmedAt),
    }
  }

  private translate(message: string, status?: number): AuthError {
    const lower = message.toLowerCase()
    if (lower.includes('already registered') || lower.includes('already been registered')) {
      return { kind: 'email_already_used' }
    }
    if (lower.includes('password')) {
      return {
        kind: 'weak_password',
        message: 'Ce mot de passe est refusé par le fournisseur d’authentification.',
      }
    }
    if (status === 429) return { kind: 'rate_limited' }
    if (lower.includes('token') || lower.includes('expired')) return { kind: 'invalid_token' }
    return { kind: 'provider_unavailable', message }
  }
}
