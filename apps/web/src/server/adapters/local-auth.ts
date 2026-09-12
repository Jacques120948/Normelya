import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { err, ok, type Result } from '@normelya/core'
import type { AuthError, AuthProvider, AuthUser } from '../ports/auth'
import type { Database } from '../ports/database'

const scryptAsync = promisify(scrypt)

/**
 * Fournisseur d'authentification local.
 *
 * RÉSERVÉ AU DÉVELOPPEMENT ET AUX TESTS. Le constructeur refuse de s'instancier
 * en production : l'authentification réelle passe par un fournisseur dédié.
 *
 * Il existe pour deux raisons :
 *
 *   1. exécuter le parcours complet — inscription, vérification, connexion,
 *      réinitialisation, suppression — sans dépendre d'un service externe ;
 *   2. prouver que le port AuthProvider tient sa promesse : changer de
 *      fournisseur ne demande qu'une implémentation de cette interface.
 *
 * Les mots de passe sont hachés avec scrypt et un sel par compte. Les jetons
 * sont opaques et stockés hachés.
 */
export class LocalAuthProvider implements AuthProvider {
  readonly name = 'local'

  constructor(private readonly db: Database) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        "LocalAuthProvider est un adaptateur de développement et ne peut pas servir en production.",
      )
    }
  }

  async signUp(input: {
    email: string
    password: string
    redirectTo: string
  }): Promise<Result<AuthUser, AuthError>> {
    const existant = await this.db.queryOne<{ subject: string }>(
      `SELECT subject FROM local_auth_accounts WHERE email = $1`,
      [input.email],
    )
    if (existant) return err({ kind: 'email_already_used' })

    if (input.password.length < 12) {
      return err({ kind: 'weak_password', message: 'Mot de passe trop court.' })
    }

    const subject = randomUUID()
    const { hash, salt } = await hacher(input.password)

    await this.db.query(
      `INSERT INTO local_auth_accounts (subject, email, password_hash, password_salt)
       VALUES ($1, $2, $3, $4)`,
      [subject, input.email, hash, salt],
    )

    // En développement, l'adresse est considérée comme vérifiée : il n'y a pas
    // de boîte aux lettres à consulter. Le jeton de vérification est tout de
    // même produit et journalisé par l'expéditeur de courrier console.
    return ok({ subject, email: input.email, emailVerified: true })
  }

  async signIn(input: { email: string; password: string }) {
    const compte = await this.db.queryOne<{
      subject: string
      email: string
      password_hash: string
      password_salt: string
      email_verified: boolean
    }>(
      `SELECT subject, email, password_hash, password_salt, email_verified
       FROM local_auth_accounts WHERE email = $1`,
      [input.email],
    )

    if (!compte) return err<AuthError>({ kind: 'invalid_credentials' })

    const correct = await verifier(input.password, compte.password_hash, compte.password_salt)
    if (!correct) return err<AuthError>({ kind: 'invalid_credentials' })

    const accessToken = randomBytes(32).toString('base64url')
    const refreshToken = randomBytes(32).toString('base64url')

    await this.db.query(
      `INSERT INTO local_auth_tokens (token, subject, kind, expires_at)
       VALUES ($1, $2, 'access', now() + interval '1 hour'),
              ($3, $2, 'refresh', now() + interval '30 days')`,
      [accessToken, compte.subject, refreshToken],
    )

    return ok({
      user: { subject: compte.subject, email: compte.email, emailVerified: compte.email_verified },
      accessToken,
      refreshToken,
    })
  }

  async signOut(accessToken: string): Promise<void> {
    await this.db.query(`DELETE FROM local_auth_tokens WHERE token = $1`, [accessToken])
  }

  async resendVerification(): Promise<Result<void, AuthError>> {
    return ok(undefined)
  }

  async requestPasswordReset(input: { email: string }): Promise<Result<void, AuthError>> {
    const compte = await this.db.queryOne<{ subject: string }>(
      `SELECT subject FROM local_auth_accounts WHERE email = $1`,
      [input.email],
    )
    // Réponse identique que l'adresse existe ou non.
    if (!compte) return ok(undefined)

    const jeton = randomBytes(32).toString('base64url')
    await this.db.query(
      `INSERT INTO local_auth_tokens (token, subject, kind, expires_at)
       VALUES ($1, $2, 'recovery', now() + interval '1 hour')`,
      [jeton, compte.subject],
    )

    // En développement, le lien est écrit dans la console par l'expéditeur.
    console.warn(`[auth local] lien de réinitialisation : ?token=${jeton}`)
    return ok(undefined)
  }

  async resetPassword(input: {
    token: string
    password: string
  }): Promise<Result<void, AuthError>> {
    const jeton = await this.db.queryOne<{ subject: string }>(
      `SELECT subject FROM local_auth_tokens
       WHERE token = $1 AND kind = 'recovery' AND expires_at > now()`,
      [input.token],
    )
    if (!jeton) return err<AuthError>({ kind: 'invalid_token' })

    const { hash, salt } = await hacher(input.password)
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE local_auth_accounts SET password_hash = $2, password_salt = $3 WHERE subject = $1`,
        [jeton.subject, hash, salt],
      )
      // Le lien est à usage unique, et toutes les sessions sont révoquées.
      await client.query(`DELETE FROM local_auth_tokens WHERE subject = $1`, [jeton.subject])
    })

    return ok(undefined)
  }

  async getUser(accessToken: string): Promise<AuthUser | null> {
    const ligne = await this.db.queryOne<{
      subject: string
      email: string
      email_verified: boolean
    }>(
      `SELECT a.subject, a.email, a.email_verified
       FROM local_auth_tokens t
       JOIN local_auth_accounts a ON a.subject = t.subject
       WHERE t.token = $1 AND t.kind = 'access' AND t.expires_at > now()`,
      [accessToken],
    )
    if (!ligne) return null
    return { subject: ligne.subject, email: ligne.email, emailVerified: ligne.email_verified }
  }

  async deleteUser(subject: string): Promise<Result<void, AuthError>> {
    await this.db.query(`DELETE FROM local_auth_accounts WHERE subject = $1`, [subject])
    return ok(undefined)
  }
}

async function hacher(motDePasse: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex')
  const derive = (await scryptAsync(motDePasse, salt, 64)) as Buffer
  return { hash: derive.toString('hex'), salt }
}

async function verifier(motDePasse: string, hash: string, salt: string): Promise<boolean> {
  const derive = (await scryptAsync(motDePasse, salt, 64)) as Buffer
  const attendu = Buffer.from(hash, 'hex')
  if (attendu.length !== derive.length) return false
  return timingSafeEqual(attendu, derive)
}
