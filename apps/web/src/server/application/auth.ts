import {
  AppError,
  err,
  ok,
  type Result,
  type SignInInput,
  type SignUpInput,
} from '@normelya/core'
import type { AuthError, AuthProvider } from '../ports/auth'
import type { Database } from '../ports/database'
import type { MailSender } from '../ports/mail'
import { recordAudit } from '../security/audit'
import { hashIdentifier } from '../security/hashing'
import {
  RATE_LIMIT_RULES,
  rateLimitKey,
  type RateLimiter,
} from '../security/rate-limit'

/**
 * Cas d'usage d'authentification.
 *
 * Deux principes de sécurité guident ce module :
 *
 * 1. Aucun message ne permet de savoir si une adresse e-mail est enregistrée.
 *    « Identifiants incorrects » et « si un compte existe, un e-mail a été
 *    envoyé » sont les seules réponses possibles.
 *
 * 2. Les points d'entrée sensibles sont limités en débit avant tout appel au
 *    fournisseur : cela protège aussi bien l'utilisateur que la facture.
 */

export type AuthDeps = {
  auth: AuthProvider
  db: Database
  serviceDb: Database
  mail: MailSender
  rateLimiter: RateLimiter
  appUrl: string
}

export type RequestMeta = {
  ip?: string | null
  userAgent?: string | null
}

export type SignUpOutcome = {
  /** Toujours vrai côté interface : le message ne révèle pas l'existence du compte. */
  emailSent: boolean
  userId: string | null
}

export async function signUp(
  deps: AuthDeps,
  input: SignUpInput,
  meta: RequestMeta = {},
): Promise<Result<SignUpOutcome, AppError>> {
  const limite = await deps.rateLimiter.check(
    rateLimitKey('signUp', hashIdentifier(meta.ip) ?? 'inconnu'),
    RATE_LIMIT_RULES.signUp,
  )
  if (!limite.allowed) return err(AppError.rateLimited())

  const created = await deps.auth.signUp({
    email: input.email,
    password: input.password,
    redirectTo: `${deps.appUrl}/connexion?verifie=1`,
  })

  if (!created.ok) {
    // Une adresse déjà utilisée ne doit pas être signalée comme telle :
    // on renvoie le même message que pour une création réussie.
    if (created.error.kind === 'email_already_used') {
      return ok({ emailSent: true, userId: null })
    }
    return err(traduireErreurAuth(created.error))
  }

  // Création de la fiche applicative. Écriture de confiance : la table users
  // n'accepte aucune insertion depuis le rôle applicatif.
  const userId = await deps.serviceDb.transaction(async (client) => {
    const row = await client.queryOne<{ id: string }>(
      `INSERT INTO users (auth_provider, auth_subject, email, email_verified_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (auth_provider, auth_subject) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [
        deps.auth.name,
        created.value.subject,
        created.value.email,
        created.value.emailVerified ? new Date() : null,
      ],
    )
    const id = row?.id ?? null
    await recordAudit(client, {
      organizationId: null,
      actorUserId: id,
      action: 'user.signed_up',
      entityType: 'user',
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    return id
  })

  return ok({ emailSent: true, userId })
}

export type SignInOutcome = {
  accessToken: string
  refreshToken: string
  emailVerified: boolean
}

export async function signIn(
  deps: AuthDeps,
  input: SignInInput,
  meta: RequestMeta = {},
): Promise<Result<SignInOutcome, AppError>> {
  const cle = rateLimitKey('signIn', hashIdentifier(`${meta.ip}|${input.email}`) ?? 'inconnu')
  const limite = await deps.rateLimiter.check(cle, RATE_LIMIT_RULES.signIn)
  if (!limite.allowed) return err(AppError.rateLimited())

  const result = await deps.auth.signIn({ email: input.email, password: input.password })
  if (!result.ok) {
    return err(
      new AppError('UNAUTHENTICATED', 'Adresse e-mail ou mot de passe incorrect.'),
    )
  }

  // Une connexion réussie remet le compteur à zéro : un utilisateur légitime
  // qui s'est trompé plusieurs fois n'est pas puni ensuite.
  await deps.rateLimiter.reset(cle)

  await deps.serviceDb.transaction(async (client) => {
    const row = await client.queryOne<{ id: string }>(
      `UPDATE users
       SET last_seen_at = now(),
           email_verified_at = CASE
             WHEN $3 AND email_verified_at IS NULL THEN now()
             ELSE email_verified_at
           END
       WHERE auth_provider = $1 AND auth_subject = $2
       RETURNING id`,
      [deps.auth.name, result.value.user.subject, result.value.user.emailVerified],
    )
    await recordAudit(client, {
      organizationId: null,
      actorUserId: row?.id ?? null,
      action: 'user.signed_in',
      entityType: 'user',
      entityId: row?.id ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  })

  return ok({
    accessToken: result.value.accessToken,
    refreshToken: result.value.refreshToken,
    emailVerified: result.value.user.emailVerified,
  })
}

export async function requestPasswordReset(
  deps: AuthDeps,
  email: string,
  meta: RequestMeta = {},
): Promise<Result<void, AppError>> {
  const limite = await deps.rateLimiter.check(
    rateLimitKey('passwordReset', hashIdentifier(`${meta.ip}|${email}`) ?? 'inconnu'),
    RATE_LIMIT_RULES.passwordReset,
  )
  // Même en cas de dépassement, la réponse reste identique côté interface.
  if (!limite.allowed) return ok(undefined)

  await deps.auth.requestPasswordReset({
    email,
    redirectTo: `${deps.appUrl}/reinitialiser-mot-de-passe`,
  })
  return ok(undefined)
}

export async function resetPassword(
  deps: AuthDeps,
  input: { token: string; password: string },
): Promise<Result<void, AppError>> {
  const result = await deps.auth.resetPassword(input)
  if (!result.ok) {
    if (result.error.kind === 'invalid_token') {
      return err(
        new AppError(
          'VALIDATION_FAILED',
          'Ce lien de réinitialisation est expiré ou déjà utilisé. Demandez-en un nouveau.',
        ),
      )
    }
    return err(traduireErreurAuth(result.error))
  }
  return ok(undefined)
}

export async function resendVerification(
  deps: AuthDeps,
  email: string,
  meta: RequestMeta = {},
): Promise<Result<void, AppError>> {
  const limite = await deps.rateLimiter.check(
    rateLimitKey('resendVerification', hashIdentifier(`${meta.ip}|${email}`) ?? 'inconnu'),
    RATE_LIMIT_RULES.resendVerification,
  )
  if (!limite.allowed) return ok(undefined)

  await deps.auth.resendVerification({
    email,
    redirectTo: `${deps.appUrl}/connexion?verifie=1`,
  })
  return ok(undefined)
}

export async function signOut(
  deps: AuthDeps,
  input: { accessToken: string | null; userId: string | null },
  meta: RequestMeta = {},
): Promise<void> {
  if (input.accessToken) await deps.auth.signOut(input.accessToken)
  if (input.userId) {
    await deps.serviceDb.transaction((client) =>
      recordAudit(client, {
        organizationId: null,
        actorUserId: input.userId,
        action: 'user.signed_out',
        entityType: 'user',
        entityId: input.userId,
        ip: meta.ip,
        userAgent: meta.userAgent,
      }),
    )
  }
}

/**
 * Suppression de compte (effacement RGPD).
 *
 * Ordre volontaire : on efface d'abord les données applicatives, puis le compte
 * chez le fournisseur. Si la seconde étape échoue, il reste un compte
 * d'authentification orphelin — gênant mais sans donnée ; l'inverse laisserait
 * des données sans propriétaire identifiable.
 */
export async function deleteAccount(
  deps: AuthDeps,
  input: { userId: string; authSubject: string; email: string },
  meta: RequestMeta = {},
): Promise<Result<void, AppError>> {
  await deps.serviceDb.transaction(async (client) => {
    // La trace de l'effacement est écrite AVANT l'effacement lui-même, tant que
    // le compte existe encore.
    await recordAudit(client, {
      organizationId: null,
      actorUserId: input.userId,
      action: 'user.deleted',
      entityType: 'user',
      entityId: input.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })

    // Les attestations de validation sont pseudonymisées, pas supprimées : le
    // nom et l'adresse sont effacés, l'horodatage, l'empreinte des données
    // validées, la version du moteur et l'identifiant technique du compte sont
    // conservés, et la date de purge est posée à dix ans.
    // Base légale : règlement (UE) 2016/679, article 17, paragraphe 3, point e).
    // Voir docs/18-conservation-des-attestations.md
    await client.query(`SELECT app.pseudonymize_attestations($1, now())`, [input.userId])

    // Mode effacement : seule situation où une ligne à valeur probante peut
    // être supprimée ou dissociée. Le paramètre ne vaut que pour cette
    // transaction et n'est posé que par ce cas d'usage.
    await client.query(`SELECT set_config('app.erasure_mode', 'on', true)`)

    // Les organisations dont l'utilisateur est le seul membre sont supprimées
    // avec lui ; les autres lui survivent.
    await client.query(
      `DELETE FROM organizations o
       WHERE o.id IN (
         SELECT m.organization_id
         FROM organization_members m
         WHERE m.user_id = $1
         GROUP BY m.organization_id
         HAVING count(*) FILTER (WHERE m.user_id <> $1) = 0
       )
       AND NOT EXISTS (
         SELECT 1 FROM organization_members other
         WHERE other.organization_id = o.id AND other.user_id <> $1
       )`,
      [input.userId],
    )

    await client.query(`DELETE FROM users WHERE id = $1`, [input.userId])
  })

  const removed = await deps.auth.deleteUser(input.authSubject)
  if (!removed.ok) {
    console.error("Compte applicatif supprimé mais suppression du compte d'authentification échouée", {
      userId: input.userId,
    })
  }

  await deps.mail
    .send({
      to: input.email,
      template: 'account_deleted',
      locale: 'fr',
      variables: {},
    })
    .catch(() => undefined)

  return ok(undefined)
}

function traduireErreurAuth(error: AuthError): AppError {
  switch (error.kind) {
    case 'invalid_credentials':
      return new AppError('UNAUTHENTICATED', 'Adresse e-mail ou mot de passe incorrect.')
    case 'email_already_used':
      return new AppError('CONFLICT', 'Un compte existe déjà pour cette adresse.')
    case 'weak_password':
      return new AppError('VALIDATION_FAILED', error.message)
    case 'invalid_token':
      return new AppError('VALIDATION_FAILED', 'Ce lien est expiré ou invalide.')
    case 'rate_limited':
      return AppError.rateLimited()
    case 'provider_unavailable':
      return new AppError(
        'PROVIDER_ERROR',
        "Le service d'authentification est momentanément indisponible. Réessayez dans un instant.",
      )
  }
}
