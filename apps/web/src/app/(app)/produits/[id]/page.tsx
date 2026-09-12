import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  MARKET_LABELS,
  PRODUCT_TYPE_LABELS,
  formatDecimal,
  type IngredientRole,
  type Market,
} from '@normelya/core'
import { Alert, Badge, Button, Card, CardBody, CardHeader } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import {
  findProduct,
  listProductVersions,
  listRecipeIngredients,
  listSelectableMaterials,
} from '@/server/repositories/products'
import { archiverProduitAction } from '../actions'
import { EditeurRecette, type LigneRecette } from './recette'

export const metadata: Metadata = { title: 'Produit' }
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erreur?: string }>
}) {
  const { context } = await exigerAtelier()
  const { id } = await params
  const { erreur } = await searchParams
  const { db } = services()

  // Requêtes séquentielles : un même client PostgreSQL ne supporte pas les
  // requêtes concurrentes dans une transaction.
  const donnees = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    async (client) => {
      const produit = await findProduct(client, context.organizationId, id)
      if (!produit) return null
      const ingredients = produit.current_version_id
        ? await listRecipeIngredients(client, context.organizationId, produit.current_version_id)
        : []
      const versions = await listProductVersions(client, context.organizationId, id)
      const matieres = await listSelectableMaterials(client, context.organizationId)
      return { produit, ingredients, versions, matieres }
    },
  )

  if (!donnees) notFound()
  const { produit, ingredients, versions, matieres } = donnees

  const versionCourante = versions.find((version) => version.id === produit.current_version_id)
  const lignes: LigneRecette[] = ingredients.map((ingredient) => ({
    rawMaterialId: ingredient.raw_material_id,
    // Le champ de saisie reçoit le nombre seul : un signe « % » repartirait
    // tel quel au serveur au prochain enregistrement.
    percent: formatDecimal(Number(ingredient.percent), 3),
    role: ingredient.role as IngredientRole,
  }))

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/produits"
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          ← {fr.produits.titre}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{produit.name}</h1>
          <p className="mt-1 text-[var(--color-ink-500)]">
            {PRODUCT_TYPE_LABELS[produit.product_type]} · {libelleMarches(produit.markets)}
            {produit.net_weight_grams
              ? ` · ${formatDecimal(Number(produit.net_weight_grams), 1)} g`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {produit.status === 'archived' ? <Badge tone="neutral">{fr.produits.archive}</Badge> : null}
          {versionCourante ? (
            <Badge tone="brand">
              {fr.produits.version} {versionCourante.version_number}
            </Badge>
          ) : null}
        </div>
      </header>

      {erreur === 'quota' ? (
        <Alert tone="danger">
          Votre offre ne permet pas de réactiver ce produit. Consultez votre{' '}
          <Link href="/abonnement" className="underline underline-offset-4">
            abonnement
          </Link>
          .
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={fr.produits.recette}
          description="Saisissez le pourcentage réel de chaque matière. Le total doit atteindre exactement 100 %."
        />
        <CardBody>
          <EditeurRecette
            productId={produit.id}
            matieres={matieres.map((matiere) => ({
              id: matiere.id,
              name: matiere.name,
              category: matiere.category,
              versionFdsValidee: matiere.validated_sds_version_id,
              libelleFdsValidee: matiere.validated_sds_label,
            }))}
            lignesInitiales={lignes}
            versionFigee={versionCourante?.is_locked ?? false}
          />
        </CardBody>
      </Card>

      {versions.length > 1 ? (
        <Card>
          <CardHeader
            title={fr.produits.versions}
            description="Chaque version analysée est conservée telle quelle, pour pouvoir être rejouée."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-medium">
                    {fr.produits.version} {version.version_number}
                  </span>
                  <span className="text-[var(--color-ink-500)]">
                    {new Date(version.created_at).toLocaleDateString('fr-FR')} ·{' '}
                    {libelleMarches(version.markets)}
                  </span>
                  {version.is_locked ? (
                    <Badge tone="neutral">Figée</Badge>
                  ) : (
                    <Badge tone="brand">Modifiable</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <form action={archiverProduitAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={produit.id} />
            <input
              type="hidden"
              name="archiver"
              value={produit.status === 'archived' ? '0' : '1'}
            />
            <Button type="submit" variant="secondary" size="sm">
              {produit.status === 'archived' ? fr.produits.reactiver : fr.produits.archiver}
            </Button>
            <p className="text-xs text-[var(--color-ink-300)]">
              Un produit archivé reste consultable, avec ses analyses et ses documents.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

function libelleMarches(marches: Market[] | null): string {
  if (!marches || marches.length === 0) return '—'
  return marches.map((marche) => MARKET_LABELS[marche] ?? marche).join(', ')
}
