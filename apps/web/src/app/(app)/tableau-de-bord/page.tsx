import type { Metadata } from 'next'
import { Alert, Card, CardBody, CardHeader, EmptyState, StatCard } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const { user } = await exigerAtelier()
  const parametres = await searchParams

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {fr.tableauDeBord.bonjour(user.firstName ?? '')}
        </h1>
        <p className="mt-1 text-[var(--color-ink-500)]">{fr.tableauDeBord.sousTitre}</p>
      </header>

      {parametres.bienvenue ? <Alert tone="success">{fr.onboarding.pret}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={fr.tableauDeBord.produitsAnalyses} value={0} />
        <StatCard label={fr.tableauDeBord.produitsAVerifier} value={0} tone="warning" />
        <StatCard label={fr.tableauDeBord.documentsAMettreAJour} value={0} tone="warning" />
        <StatCard label={fr.tableauDeBord.matieresPremieres} value={0} />
      </div>

      <Card>
        <CardHeader title={fr.tableauDeBord.produitsRecents} />
        <CardBody>
          <EmptyState title={fr.tableauDeBord.aucunProduit} />
        </CardBody>
      </Card>
    </div>
  )
}
