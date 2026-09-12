import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui'
import { FormulaireMotDePasseOublie } from './formulaire'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default function Page() {
  return (
    <Card>
      <CardBody className="space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="text-xl font-semibold">Mot de passe oublié</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            Indiquez votre adresse e-mail : nous vous enverrons un lien de réinitialisation.
          </p>
        </div>

        <FormulaireMotDePasseOublie />

        <Link
          href="/connexion"
          className="inline-block text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      </CardBody>
    </Card>
  )
}
