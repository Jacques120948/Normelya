import Link from 'next/link'
import type { Metadata } from 'next'
import { STATUS_PRESENTATION, type NormelyaStatus } from '@normelya/core'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatCard,
  StatusBadge,
} from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import {
  dashboardCounts,
  openNotifications,
  recentDocuments,
  recentProducts,
} from '@/server/repositories/dashboard'

export const metadata: Metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const { user, context } = await exigerAtelier()
  const parametres = await searchParams
  const { db } = services()

  const [compteurs, produits, alertes, documents] = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    async (client) =>
      Promise.all([
        dashboardCounts(client, context.organizationId),
        recentProducts(client, context.organizationId),
        openNotifications(client, context.organizationId),
        recentDocuments(client, context.organizationId),
      ]),
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          {fr.tableauDeBord.bonjour(user.firstName ?? '')}
        </h1>
        <p className="mt-1 text-[var(--color-ink-500)]">{fr.tableauDeBord.sousTitre}</p>
      </header>

      {parametres.bienvenue ? (
        <Alert tone="success" title={fr.onboarding.pret}>
          Commencez par enregistrer les matières premières que vous utilisez le plus souvent.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={fr.tableauDeBord.produitsAnalyses} value={compteurs.analyzedProducts} />
        <StatCard
          label={fr.tableauDeBord.produitsAVerifier}
          value={compteurs.productsToCheck}
          tone={compteurs.productsToCheck > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label={fr.tableauDeBord.documentsAMettreAJour}
          value={compteurs.documentsToUpdate}
          tone={compteurs.documentsToUpdate > 0 ? 'warning' : 'neutral'}
        />
        <StatCard label={fr.tableauDeBord.matieresPremieres} value={compteurs.rawMaterials} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button disabled title="Disponible à la prochaine étape">
          + {fr.actions.nouveauProduit}
        </Button>
        <Link href="/matieres-premieres/nouvelle">
          <Button variant="secondary">+ {fr.actions.ajouterMatiere}</Button>
        </Link>
        <Button variant="secondary" disabled title="Disponible à la prochaine étape">
          + {fr.actions.importerFds}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={fr.tableauDeBord.produitsRecents} />
          <CardBody className={produits.length === 0 ? undefined : 'p-0'}>
            {produits.length === 0 ? (
              <EmptyState title={fr.tableauDeBord.aucunProduit} />
            ) : (
              <ul className="divide-y divide-[var(--color-ink-100)]">
                {produits.map((produit) => (
                  <li
                    key={produit.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="truncate text-sm font-medium">{produit.name}</span>
                    <StatusBadge status={statutProduit(produit.overall_status)} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={fr.tableauDeBord.alertes} />
          <CardBody className={alertes.length === 0 ? undefined : 'p-0'}>
            {alertes.length === 0 ? (
              <EmptyState title={fr.tableauDeBord.aucuneAlerte} />
            ) : (
              <ul className="divide-y divide-[var(--color-ink-100)]">
                {alertes.map((alerte) => (
                  <li key={alerte.id} className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <span aria-hidden className="mt-0.5">
                        {alerte.severity === 'action' ? '●' : '⚠'}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{alerte.title}</p>
                        {alerte.body ? (
                          <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">
                            {alerte.body}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={fr.tableauDeBord.documentsRecents} />
        <CardBody className={documents.length === 0 ? undefined : 'p-0'}>
          {documents.length === 0 ? (
            <EmptyState
              title={fr.tableauDeBord.aucunDocument}
              description="Les fiches de données de sécurité de vos fournisseurs se déposeront ici."
            />
          ) : (
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.original_filename}</p>
                    {document.raw_material_name ? (
                      <p className="text-xs text-[var(--color-ink-300)]">
                        {document.raw_material_name}
                      </p>
                    ) : null}
                  </div>
                  <Badge>{document.kind.toUpperCase()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-[var(--color-ink-300)]">{fr.avertissements.outilAssistance}</p>
    </div>
  )
}

/**
 * Statut affiché pour un produit.
 *
 * Un produit sans analyse n'est pas « conforme par défaut » : il demande une
 * vérification. Aucun statut favorable n'est attribué en l'absence de calcul.
 */
function statutProduit(statut: string | null): NormelyaStatus {
  if (statut && statut in STATUS_PRESENTATION) return statut as NormelyaStatus
  return 'needs_verification'
}
