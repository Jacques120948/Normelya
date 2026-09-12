import type { Metadata } from 'next'
import { Card, CardBody, Logo } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerOnboarding } from '@/server/security/guard'
import { FormulaireOnboarding } from './formulaire'

/**
 * Segment dynamique : ces pages dépendent de la session de l'utilisateur et ne
 * doivent jamais être pré-rendues ni mises en cache.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Bienvenue' }

export default async function Page() {
  const utilisateur = await exigerOnboarding()

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-10 sm:px-8">
      <Logo size="lg" />

      <div className="mt-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">{fr.onboarding.titre}</h1>
        <p className="mt-2 text-[var(--color-ink-500)]">{fr.onboarding.sousTitre}</p>
      </div>

      <Card className="mt-8">
        <CardBody className="p-6 sm:p-8">
          <FormulaireOnboarding emailParDefaut={utilisateur.email} />
        </CardBody>
      </Card>

      <p className="mt-8 text-xs text-[var(--color-ink-300)]">
        {fr.avertissements.outilAssistance}
      </p>
    </div>
  )
}
