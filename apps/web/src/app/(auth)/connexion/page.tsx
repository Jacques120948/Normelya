import Link from 'next/link'
import type { Metadata } from 'next'
import { Alert, Card, CardBody } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { FormulaireConnexion } from './formulaire'

export const metadata: Metadata = { title: 'Connexion' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ verifie?: string; motdepasse?: string }>
}) {
  const parametres = await searchParams

  return (
    <Card>
      <CardBody className="space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.auth.connexionTitre}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">{fr.auth.connexionSousTitre}</p>
        </div>

        {parametres.verifie ? (
          <Alert tone="success">
            Votre adresse est confirmée. Vous pouvez vous connecter.
          </Alert>
        ) : null}

        {parametres.motdepasse === 'modifie' ? (
          <Alert tone="success">
            Votre mot de passe a été modifié. Connectez-vous avec le nouveau.
          </Alert>
        ) : null}

        <FormulaireConnexion />

        <p className="text-sm text-[var(--color-ink-500)]">
          {fr.auth.pasEncoreInscrit}{' '}
          <Link
            href="/inscription"
            className="font-medium text-[var(--color-normelya-600)] underline-offset-4 hover:underline"
          >
            {fr.actions.creerCompte}
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
