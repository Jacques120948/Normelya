'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@normelya/core'
import { services } from '@/server/container'
import { serverEnv } from '@/server/env'
import {
  requestPasswordReset as requestPasswordResetUseCase,
  resetPassword as resetPasswordUseCase,
  signIn as signInUseCase,
  signUp as signUpUseCase,
} from '@/server/application/auth'
import { clearSessionCookies, readAccessToken, setSessionCookies } from '@/server/security/session'

/**
 * Actions serveur du parcours d'authentification.
 *
 * Toutes les entrées sont revalidées ici : les contrôles effectués dans le
 * navigateur ne sont qu'un confort d'utilisation.
 */

export type FormState = {
  erreur?: string
  succes?: string
  champs?: Record<string, string>
}

async function requestMeta() {
  const entetes = await headers()
  return {
    // L'adresse est immédiatement hachée par la couche de sécurité : elle n'est
    // jamais conservée en clair.
    ip: entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: entetes.get('user-agent'),
  }
}

function dependances() {
  const { auth, db, serviceDb, mail, rateLimiter } = services()
  return { auth, db, serviceDb, mail, rateLimiter, appUrl: serverEnv().APP_URL }
}

function erreursDeValidation(issues: { path: (string | number)[]; message: string }[]) {
  const champs: Record<string, string> = {}
  for (const issue of issues) {
    const cle = String(issue.path[0] ?? 'global')
    champs[cle] ??= issue.message
  }
  return champs
}

export async function inscriptionAction(
  _etat: FormState,
  donnees: FormData,
): Promise<FormState> {
  const analyse = signUpSchema.safeParse({
    email: donnees.get('email'),
    password: donnees.get('password'),
    acceptTerms: donnees.get('acceptTerms') === 'on',
  })
  if (!analyse.success) {
    return { champs: erreursDeValidation(analyse.error.issues) }
  }

  const resultat = await signUpUseCase(dependances(), analyse.data, await requestMeta())
  if (!resultat.ok) {
    return { erreur: resultat.error.userMessage }
  }

  redirect('/inscription?envoye=1')
}

export async function connexionAction(_etat: FormState, donnees: FormData): Promise<FormState> {
  const analyse = signInSchema.safeParse({
    email: donnees.get('email'),
    password: donnees.get('password'),
  })
  if (!analyse.success) {
    return { champs: erreursDeValidation(analyse.error.issues) }
  }

  const resultat = await signInUseCase(dependances(), analyse.data, await requestMeta())
  if (!resultat.ok) {
    return { erreur: resultat.error.userMessage }
  }

  await setSessionCookies({
    accessToken: resultat.value.accessToken,
    refreshToken: resultat.value.refreshToken,
  })

  redirect('/tableau-de-bord')
}

export async function motDePasseOublieAction(
  _etat: FormState,
  donnees: FormData,
): Promise<FormState> {
  const analyse = requestPasswordResetSchema.safeParse({ email: donnees.get('email') })
  if (!analyse.success) {
    return { champs: erreursDeValidation(analyse.error.issues) }
  }

  await requestPasswordResetUseCase(dependances(), analyse.data.email, await requestMeta())

  // Réponse identique que l'adresse existe ou non.
  return { succes: 'envoye' }
}

export async function reinitialiserMotDePasseAction(
  _etat: FormState,
  donnees: FormData,
): Promise<FormState> {
  const analyse = resetPasswordSchema.safeParse({
    token: donnees.get('token'),
    password: donnees.get('password'),
    passwordConfirmation: donnees.get('passwordConfirmation'),
  })
  if (!analyse.success) {
    return { champs: erreursDeValidation(analyse.error.issues) }
  }

  const resultat = await resetPasswordUseCase(dependances(), {
    token: analyse.data.token,
    password: analyse.data.password,
  })
  if (!resultat.ok) {
    return { erreur: resultat.error.userMessage }
  }

  redirect('/connexion?motdepasse=modifie')
}

export async function deconnexionAction(): Promise<void> {
  const jeton = await readAccessToken()
  const { auth } = services()
  if (jeton) await auth.signOut(jeton)
  await clearSessionCookies()
  redirect('/connexion')
}
