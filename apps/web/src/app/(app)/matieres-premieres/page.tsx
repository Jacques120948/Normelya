import Link from 'next/link'
import type { Metadata } from 'next'
import {
  RAW_MATERIAL_CATEGORIES,
  RAW_MATERIAL_CATEGORY_LABELS,
  type RawMaterialCategory,
} from '@normelya/core'
import { Badge, Button, Card, CardBody, EmptyState, Input } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { listRawMaterials, type SdsState } from '@/server/repositories/raw-materials'

export const metadata: Metadata = { title: 'Matières premières' }
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; q?: string; archivees?: string }>
}) {
  const { context } = await exigerAtelier()
  const parametres = await searchParams
  const { db } = services()

  const categorie = (RAW_MATERIAL_CATEGORIES as readonly string[]).includes(
    parametres.categorie ?? '',
  )
    ? (parametres.categorie as RawMaterialCategory)
    : undefined

  const matieres = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) =>
      listRawMaterials(client, context.organizationId, {
        category: categorie,
        search: parametres.q?.trim() || undefined,
        includeArchived: parametres.archivees === '1',
      }),
  )

  const filtreActif = Boolean(categorie || parametres.q)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{fr.matieres.titre}</h1>
          <p className="mt-1 text-[var(--color-ink-500)]">{fr.matieres.sousTitre}</p>
        </div>
        <Link href="/matieres-premieres/nouvelle">
          <Button>+ {fr.actions.ajouterMatiere}</Button>
        </Link>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={parametres.q ?? ''}
          placeholder="Rechercher un nom, une référence, un fournisseur"
          className="max-w-sm"
          aria-label="Rechercher une matière première"
        />
        {categorie ? <input type="hidden" name="categorie" value={categorie} /> : null}
        <Button type="submit" variant="secondary" size="sm">
          Rechercher
        </Button>
      </form>

      <nav aria-label="Filtrer par catégorie" className="flex flex-wrap gap-2">
        <LienFiltre actif={!categorie} href="/matieres-premieres" libelle="Toutes" />
        {RAW_MATERIAL_CATEGORIES.map((valeur) => (
          <LienFiltre
            key={valeur}
            actif={categorie === valeur}
            href={`/matieres-premieres?categorie=${valeur}`}
            libelle={RAW_MATERIAL_CATEGORY_LABELS[valeur]}
          />
        ))}
      </nav>

      {matieres.length === 0 ? (
        <EmptyState
          title={filtreActif ? 'Aucun résultat pour cette recherche.' : fr.matieres.aucune}
          description={filtreActif ? undefined : fr.matieres.aucuneAide}
          action={
            filtreActif ? (
              <Link href="/matieres-premieres">
                <Button variant="secondary" size="sm">
                  Réinitialiser les filtres
                </Button>
              </Link>
            ) : (
              <Link href="/matieres-premieres/nouvelle">
                <Button size="sm">+ {fr.actions.ajouterMatiere}</Button>
              </Link>
            )
          }
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            {/* Tableau sur grand écran, liste de cartes sur mobile. */}
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-[var(--color-ink-100)] text-left text-[var(--color-ink-500)]">
                  <th scope="col" className="px-5 py-3 font-medium">{fr.matieres.nom}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{fr.matieres.type}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{fr.matieres.fournisseur}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{fr.matieres.documents}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ink-100)]">
                {matieres.map((matiere) => (
                  <tr key={matiere.id} className="hover:bg-[var(--color-surface-muted)]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/matieres-premieres/${matiere.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {matiere.name}
                      </Link>
                      {matiere.is_demo ? (
                        <span className="ml-2">
                          <Badge tone="demo">DEMO</Badge>
                        </span>
                      ) : null}
                      {matiere.internal_reference ? (
                        <p className="text-xs text-[var(--color-ink-300)]">
                          {matiere.internal_reference}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-500)]">
                      {RAW_MATERIAL_CATEGORY_LABELS[matiere.category]}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-ink-500)]">
                      {matiere.supplier_name ?? fr.matieres.sansFournisseur}
                    </td>
                    <td className="px-5 py-3">
                      <EtatFds etat={matiere.sds_state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-[var(--color-ink-100)] sm:hidden">
              {matieres.map((matiere) => (
                <li key={matiere.id} className="px-5 py-4">
                  <Link href={`/matieres-premieres/${matiere.id}`} className="block">
                    <p className="font-medium">{matiere.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-ink-500)]">
                      {RAW_MATERIAL_CATEGORY_LABELS[matiere.category]} ·{' '}
                      {matiere.supplier_name ?? fr.matieres.sansFournisseur}
                    </p>
                    <div className="mt-2">
                      <EtatFds etat={matiere.sds_state} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

function LienFiltre({
  actif,
  href,
  libelle,
}: {
  actif: boolean
  href: string
  libelle: string
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? 'true' : undefined}
      className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
        actif
          ? 'bg-[var(--color-normelya-600)] text-white'
          : 'border border-[var(--color-ink-100)] text-[var(--color-ink-700)] hover:bg-[var(--color-surface-sunken)]'
      }`}
    >
      {libelle}
    </Link>
  )
}

/**
 * État du dossier documentaire.
 *
 * Il décrit l'avancement de la saisie, jamais une appréciation réglementaire :
 * une FDS validée signifie « vérifiée par vous », et rien de plus.
 */
function EtatFds({ etat }: { etat: SdsState }) {
  const presentation: Record<SdsState, { libelle: string; classe: string; symbole: string }> = {
    validated: {
      libelle: fr.matieres.fdsValidee,
      classe: 'bg-[var(--color-normelya-50)] text-[var(--color-status-success)]',
      symbole: '✓',
    },
    needs_review: {
      libelle: fr.matieres.fdsAVerifier,
      classe: 'bg-[var(--color-amber-brand-50)] text-[var(--color-status-warning)]',
      symbole: '⚠',
    },
    missing: {
      libelle: fr.matieres.fdsManquante,
      classe: 'bg-[var(--color-surface-sunken)] text-[var(--color-status-neutral)]',
      symbole: '○',
    },
  }
  const item = presentation[etat]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${item.classe}`}
    >
      <span aria-hidden>{item.symbole}</span>
      {item.libelle}
    </span>
  )
}
