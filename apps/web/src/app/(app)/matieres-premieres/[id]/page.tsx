import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  RAW_MATERIAL_CATEGORY_LABELS,
  formatMoney,
  money,
  roleAtLeast,
} from '@normelya/core'
import { Alert, Badge, Button, Card, CardBody, CardHeader } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { findRawMaterial } from '@/server/repositories/raw-materials'
import { archiverMatiereAction, modifierMatiereAction } from '../actions'
import { FormulaireMatiere } from '../formulaire'

export const metadata: Metadata = { title: 'Matière première' }
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { context } = await exigerAtelier()
  const { id } = await params
  const { db } = services()

  const matiere = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) => findRawMaterial(client, context.organizationId, id),
  )

  if (!matiere) notFound()

  const modifiable = roleAtLeast(context.role, 'member')
  const prix =
    matiere.purchase_price_cents !== null ? formatMoney(money(matiere.purchase_price_cents)) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/matieres-premieres"
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          ← {fr.matieres.titre}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{matiere.name}</h1>
          {matiere.is_demo ? <Badge tone="demo">DEMO</Badge> : null}
          {matiere.is_archived ? <Badge>Archivée</Badge> : null}
        </div>
        <p className="mt-1 text-[var(--color-ink-500)]">
          {RAW_MATERIAL_CATEGORY_LABELS[matiere.category]} ·{' '}
          {matiere.supplier_name ?? fr.matieres.sansFournisseur}
          {prix ? ` · ${prix}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader
          title={fr.matieres.documents}
          description="Fiche de données de sécurité, certificat IFRA, déclaration d’allergènes."
        />
        <CardBody className="space-y-4">
          {matiere.sds_state === 'missing' ? (
            <Alert tone="warning" title={fr.matieres.fdsManquante}>
              Aucune fiche de données de sécurité n’est rattachée à cette matière. Sans elle,
              aucune analyse réglementaire ne pourra être produite.
            </Alert>
          ) : null}

          {matiere.sds_state === 'needs_review' ? (
            <Alert tone="warning" title={fr.matieres.fdsAVerifier}>
              Une fiche est déposée mais n’a pas encore été vérifiée et validée.
            </Alert>
          ) : null}

          {matiere.sds_state === 'validated' ? (
            <Alert tone="success" title={fr.matieres.fdsValidee}>
              Une version validée est active pour cette matière.
            </Alert>
          ) : null}

          <p className="text-sm text-[var(--color-ink-500)]">
            L’import et la vérification des fiches de données de sécurité arrivent à l’étape
            suivante du développement.
          </p>

          <Button variant="secondary" disabled title="Disponible à la prochaine étape">
            {fr.actions.importerFds}
          </Button>
        </CardBody>
      </Card>

      {modifiable ? (
        <Card>
          <CardHeader title="Modifier la fiche" />
          <CardBody className="p-6">
            <FormulaireMatiere
              action={modifierMatiereAction.bind(null, matiere.id)}
              libelleBouton={fr.actions.enregistrer}
              succes="Modifications enregistrées."
              valeurs={{
                name: matiere.name,
                category: matiere.category,
                supplierName: matiere.supplier_name ?? '',
                internalReference: matiere.internal_reference ?? '',
                purchasePrice:
                  matiere.purchase_price_cents !== null
                    ? (matiere.purchase_price_cents / 100).toFixed(2).replace('.', ',')
                    : '',
                purchaseQuantity: matiere.purchase_quantity ?? '',
                purchaseUnit: matiere.purchase_unit ?? '',
                notes: matiere.notes ?? '',
              }}
            />
          </CardBody>
        </Card>
      ) : null}

      {modifiable ? (
        <Card>
          <CardHeader
            title={matiere.is_archived ? 'Réactiver' : 'Archiver'}
            description="Une matière première n’est jamais supprimée : elle peut être citée par une recette ou une analyse déjà produite."
          />
          <CardBody>
            <form action={archiverMatiereAction}>
              <input type="hidden" name="id" value={matiere.id} />
              <input type="hidden" name="archiver" value={matiere.is_archived ? '0' : '1'} />
              <Button variant="secondary" type="submit">
                {matiere.is_archived ? 'Réactiver cette matière' : 'Archiver cette matière'}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
