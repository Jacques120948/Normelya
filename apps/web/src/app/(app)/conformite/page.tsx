import type { Metadata } from 'next'
import { Alert, Card, CardBody } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'

export const metadata: Metadata = { title: 'Conformité' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigerAtelier()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{fr.navigation.conformite}</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">
          L’état réglementaire de vos produits, et ce qu’il reste à faire.
        </p>
      </header>

      <Card>
        <CardBody className="space-y-4 p-6">
          <Alert tone="info" title="Le moteur réglementaire n’est pas encore publié">
            Aucune règle n’est active à ce jour. Normelya préfère ne rien afficher plutôt
            qu’afficher un résultat qui n’aurait pas été vérifié sur une source officielle.
          </Alert>

          <p className="text-sm text-[var(--color-ink-500)]">
            Les calculs seront produits par un moteur déterministe et versionné : chaque résultat
            indiquera la règle appliquée, sa source, la version du moteur et la date. Tant qu’une
            règle n’est pas validée sur le texte officiel, elle ne produit aucun résultat.
          </p>

          <p className="text-xs text-[var(--color-ink-300)]">{fr.avertissements.outilAssistance}</p>
        </CardBody>
      </Card>
    </div>
  )
}
