'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { onboardingSchema } from '@normelya/core'
import { services } from '@/server/container'
import { completeOnboarding } from '@/server/application/onboarding'
import { exigerOnboarding } from '@/server/security/guard'
import { setActiveOrganizationId } from '@/server/security/session'

export type EtatOnboarding = {
  erreur?: string
  champs?: Record<string, string>
}

export async function onboardingAction(
  _etat: EtatOnboarding,
  donnees: FormData,
): Promise<EtatOnboarding> {
  // La garde revérifie la session : le formulaire ne porte aucun identifiant
  // d'utilisateur, qui serait falsifiable.
  const utilisateur = await exigerOnboarding()

  const analyse = onboardingSchema.safeParse({
    firstName: donnees.get('firstName'),
    lastName: donnees.get('lastName'),
    organizationName: donnees.get('organizationName'),
    country: donnees.get('country'),
    activity: donnees.get('activity'),
    addressLine1: donnees.get('addressLine1'),
    addressLine2: donnees.get('addressLine2') ?? '',
    postalCode: donnees.get('postalCode'),
    city: donnees.get('city'),
    contactEmail: donnees.get('contactEmail'),
    contactPhone: donnees.get('contactPhone') ?? '',
  })

  if (!analyse.success) {
    const champs: Record<string, string> = {}
    for (const issue of analyse.error.issues) {
      const cle = String(issue.path[0] ?? 'global')
      champs[cle] ??= issue.message
    }
    return { champs }
  }

  const entetes = await headers()
  const resultat = await completeOnboarding(
    { serviceDb: services().serviceDb },
    { ...analyse.data, userId: utilisateur.userId },
    {
      ip: entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: entetes.get('user-agent'),
    },
  )

  if (!resultat.ok) {
    return { erreur: resultat.error.userMessage }
  }

  await setActiveOrganizationId(resultat.value.organizationId)
  redirect('/tableau-de-bord?bienvenue=1')
}
