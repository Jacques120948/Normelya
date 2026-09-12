import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardBody, CardHeader } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'
import { FormulaireProduit } from './formulaire'

export const metadata: Metadata = { title: 'Nouveau produit' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigerAtelier()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/produits"
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          ← {fr.produits.titre}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{fr.actions.nouveauProduit}</h1>
      </div>

      <Card>
        <CardHeader
          title="Décrivez le produit"
          description="Vous composerez sa recette juste après."
        />
        <CardBody>
          <FormulaireProduit />
        </CardBody>
      </Card>
    </div>
  )
}
