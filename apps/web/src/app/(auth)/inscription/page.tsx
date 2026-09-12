import Link from 'next/link'
import type { Metadata } from 'next'
import { Alert, Card, CardBody } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { FormulaireInscription } from './formulaire'

export const metadata: Metadata = { title: 'Créer un compte' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ envoye?: string }>
}) {
  const parametres = await searchParams

  if (parametres.envoye) {
    return (
      <Card>
        <CardBody className="space-y-4 p-6 sm:p-8">
          <h1 className="text-xl font-semibold">{fr.auth.verifiezEmail}</h1>
          <p className="text-sm text-[var(--color-ink-500)]">{fr.auth.verifiezEmailCorps}</p>
          <Link
            href="/connexion"
            className="inline-block text-sm font-medium text-[var(--color-normelya-600)] underline-offset-4 hover:underline"
          >
            Retour à la connexion
          </Link>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardBody className="space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="text-xl font-semibold">{fr.auth.inscriptionTitre}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">{fr.auth.inscriptionSousTitre}</p>
        </div>

        <Alert tone="info">
          L’offre gratuite permet de créer 3 produits et d’utiliser le parcours complet.
        </Alert>

        <FormulaireInscription />

        <p className="text-sm text-[var(--color-ink-500)]">
          {fr.auth.dejaInscrit}{' '}
          <Link
            href="/connexion"
            className="font-medium text-[var(--color-normelya-600)] underline-offset-4 hover:underline"
          >
            {fr.actions.seConnecter}
          </Link>
        </p>
      </CardBody>
    </Card>
  )
}
