import Link from 'next/link'
import type { Metadata } from 'next'
import { MARKET_LABELS, PRODUCT_TYPE_LABELS, type Market } from '@normelya/core'
import { Badge, Button, Card, CardBody, EmptyState, StatusBadge } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { listProducts, type ProductRow } from '@/server/repositories/products'

export const metadata: Metadata = { title: 'Produits' }
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ archives?: string }>
}) {
  const { context } = await exigerAtelier()
  const parametres = await searchParams
  const avecArchives = parametres.archives === '1'
  const { db } = services()

  const produits = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) => listProducts(client, context.organizationId, { includeArchived: avecArchives }),
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{fr.produits.titre}</h1>
          <p className="mt-1 text-[var(--color-ink-500)]">{fr.produits.sousTitre}</p>
        </div>
        <Link href="/produits/nouveau">
          <Button>+ {fr.actions.nouveauProduit}</Button>
        </Link>
      </header>

      {produits.length === 0 ? (
        <EmptyState
          title={fr.produits.aucun}
          description={fr.produits.aucunAide}
          action={
            <Link href="/produits/nouveau">
              <Button size="sm">+ {fr.actions.nouveauProduit}</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-[var(--color-ink-100)] text-left text-[var(--color-ink-500)]">
                  <th scope="col" className="px-5 py-3 font-medium">
                    {fr.produits.nom}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {fr.produits.type}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {fr.produits.marches}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {fr.produits.recette}
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    {fr.produits.derniereAnalyse}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ink-100)]">
                {produits.map((produit) => (
                  <tr key={produit.id} className="hover:bg-[var(--color-surface-muted)]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/produits/${produit.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {produit.name}
                      </Link>
                      {produit.is_demo ? (
                        <span className="ml-2">
                          <Badge tone="demo">DEMO</Badge>
                        </span>
                      ) : null}
                      {produit.status === 'archived' ? (
                        <span className="ml-2">
                          <Badge tone="neutral">{fr.produits.archive}</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-500)]">
                      {PRODUCT_TYPE_LABELS[produit.product_type]}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-500)]">
                      {libelleMarches(produit.markets)}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-500)]">
                      {resumeRecette(produit)}
                    </td>
                    <td className="px-5 py-3">
                      {produit.last_analysis_status ? (
                        <StatusBadge status={produit.last_analysis_status} />
                      ) : (
                        <span className="text-[var(--color-ink-300)]">
                          {fr.produits.aucuneAnalyse}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-[var(--color-ink-100)] sm:hidden">
              {produits.map((produit) => (
                <li key={produit.id} className="px-5 py-4">
                  <Link href={`/produits/${produit.id}`} className="block">
                    <p className="font-medium">{produit.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">
                      {PRODUCT_TYPE_LABELS[produit.product_type]} ·{' '}
                      {libelleMarches(produit.markets)} · {resumeRecette(produit)}
                    </p>
                    <div className="mt-2">
                      {produit.last_analysis_status ? (
                        <StatusBadge status={produit.last_analysis_status} />
                      ) : (
                        <span className="text-xs text-[var(--color-ink-300)]">
                          {fr.produits.aucuneAnalyse}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <p className="text-sm">
        <Link
          href={avecArchives ? '/produits' : '/produits?archives=1'}
          className="text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          {avecArchives ? fr.produits.masquerArchives : fr.produits.voirArchives}
        </Link>
      </p>
    </div>
  )
}

function libelleMarches(marches: Market[] | null): string {
  if (!marches || marches.length === 0) return '—'
  return marches.map((marche) => MARKET_LABELS[marche] ?? marche).join(', ')
}

/** Résumé de recette : nombre de matières, ou son absence dite explicitement. */
function resumeRecette(produit: ProductRow): string {
  if (produit.ingredient_count === 0) return 'Recette à composer'
  return produit.ingredient_count === 1 ? '1 matière' : `${produit.ingredient_count} matières`
}
