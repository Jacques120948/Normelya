import type { Metadata } from 'next'
import { Card, CardBody, EmptyState } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { openNotifications } from '@/server/repositories/dashboard'

export const metadata: Metadata = { title: 'Alertes' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { context } = await exigerAtelier()
  const { db } = services()

  const alertes = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) => openNotifications(client, context.organizationId, 50),
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Centre de conformité</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">
          Nouvelles versions de fiches, informations manquantes, analyses à refaire.
        </p>
      </header>

      <Card>
        <CardBody className={alertes.length === 0 ? undefined : 'p-0'}>
          {alertes.length === 0 ? (
            <EmptyState
              title={fr.tableauDeBord.aucuneAlerte}
              description="Vous serez prévenu ici dès qu’un fournisseur publie une nouvelle version d’une fiche que vous utilisez."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {alertes.map((alerte) => (
                <li key={alerte.id} className="flex gap-3 px-5 py-4">
                  <span aria-hidden className="mt-0.5">
                    {alerte.severity === 'action' ? '●' : alerte.severity === 'warning' ? '⚠' : '○'}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{alerte.title}</p>
                    {alerte.body ? (
                      <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">{alerte.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-[var(--color-ink-300)]">
                      {alerte.created_at.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
