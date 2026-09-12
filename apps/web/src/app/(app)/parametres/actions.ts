'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { deleteAccountSchema } from '@normelya/core'
import { services } from '@/server/container'
import { serverEnv } from '@/server/env'
import { deleteAccount } from '@/server/application/auth'
import { chargerSession } from '@/server/security/guard'
import { clearSessionCookies, readAccessToken } from '@/server/security/session'

export type EtatSuppression = {
  erreur?: string
}

/**
 * Suppression définitive du compte (droit à l'effacement).
 *
 * La confirmation textuelle est exigée côté serveur : une case cochée par
 * inadvertance ne doit pas suffire à détruire des données.
 */
export async function supprimerCompteAction(
  _etat: EtatSuppression,
  donnees: FormData,
): Promise<EtatSuppression> {
  const analyse = deleteAccountSchema.safeParse({ confirmation: donnees.get('confirmation') })
  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? 'Confirmation invalide.' }
  }

  const session = await chargerSession()
  if (session.kind === 'anonymous') redirect('/connexion')

  const { auth, db, serviceDb, mail, rateLimiter } = services()
  const jeton = await readAccessToken()
  const utilisateurAuth = jeton ? await auth.getUser(jeton) : null

  if (!utilisateurAuth) {
    return { erreur: 'Votre session a expiré. Reconnectez-vous et réessayez.' }
  }

  const entetes = await headers()
  await deleteAccount(
    { auth, db, serviceDb, mail, rateLimiter, appUrl: serverEnv().APP_URL },
    {
      userId: session.user.userId,
      authSubject: utilisateurAuth.subject,
      email: session.user.email,
    },
    {
      ip: entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: entetes.get('user-agent'),
    },
  )

  await clearSessionCookies()
  redirect('/connexion?compte=supprime')
}
