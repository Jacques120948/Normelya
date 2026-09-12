import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { ExtractionOutcome } from '@normelya/sds-extraction'
import { Alert, Card, CardBody, CardHeader } from '@/components/ui'
import { services } from '@/server/container'
import { exigerAtelier } from '@/server/security/guard'
import { FormulaireVerification } from './formulaire'

export const metadata: Metadata = { title: 'Vérifier une fiche' }
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>
}) {
  const { context } = await exigerAtelier()
  const { id, versionId } = await params
  const { db } = services()

  const version = await db.withContext(
    { userId: context.userId, organizationId: context.organizationId },
    (client) =>
      client.queryOne<{
        id: string
        version_label: string
        status: string
        extracted_payload: ExtractionOutcome | null
        extraction_method: string | null
        document_id: string
        original_filename: string
        raw_material_name: string
        supplier_name: string | null
      }>(
        `SELECT v.id, v.version_label, v.status::text, v.extracted_payload,
                v.extraction_method::text, v.document_id, d.original_filename,
                m.name AS raw_material_name, s.name AS supplier_name
         FROM sds_versions v
         JOIN documents d ON d.id = v.document_id
         JOIN safety_data_sheets f ON f.id = v.safety_data_sheet_id
         JOIN raw_materials m ON m.id = f.raw_material_id
         LEFT JOIN suppliers s ON s.id = m.supplier_id
         WHERE v.organization_id = $1 AND v.id = $2 AND m.id = $3`,
        [context.organizationId, versionId, id],
      ),
  )

  if (!version) notFound()

  if (version.status === 'validated') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href={`/matieres-premieres/${id}`}
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          ← {version.raw_material_name}
        </Link>
        <Alert tone="success" title="Cette version est déjà validée">
          Pour corriger une information, importez une nouvelle version de la fiche. Une version
          validée n’est jamais modifiée : c’est ce qui permet de savoir, des années plus tard, sur
          quelles données une analyse a été produite.
        </Alert>
      </div>
    )
  }

  const lecture = version.extracted_payload

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/matieres-premieres/${id}`}
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          ← {version.raw_material_name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Vérifiez les informations détectées</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">
          {version.original_filename} · version {version.version_label}
        </p>
      </div>

      <Alert tone="warning" title="Rien n’est encore enregistré">
        Normelya a lu ce document, il ne l’a pas compris. Chaque information ci-dessous est une
        proposition : corrigez ce qui est faux, complétez ce qui manque. Aucune analyse ne sera
        produite à partir de données que vous n’avez pas confirmées.
      </Alert>

      {version.extraction_method === 'manual' ? (
        <Alert tone="danger" title="Ce document n’a pas pu être lu">
          Il ne contient pas de couche de texte : c’est probablement un scan. Les champs sont vides,
          la saisie est manuelle. Demander une version numérique à votre fournisseur vous évitera ce
          travail à chaque mise à jour.
        </Alert>
      ) : null}

      {lecture && lecture.issues.length > 0 ? (
        <Card>
          <CardHeader
            title="Points d’attention"
            description="Relevés à la lecture. Ils ne bloquent rien, mais méritent un coup d’œil."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {lecture.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className="flex gap-2.5 px-5 py-3 text-sm">
                  <span aria-hidden className="mt-0.5">
                    ⚠
                  </span>
                  <span className="text-[var(--color-ink-700)]">{issue.message}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <FormulaireVerification
        matiereId={id}
        versionId={versionId}
        documentId={version.document_id}
        lecture={lecture}
        valeursParDefaut={{
          commercialName: lecture?.productName.value ?? version.raw_material_name,
          supplierName: lecture?.supplierName.value ?? version.supplier_name ?? '',
          versionLabel: lecture?.versionLabel.value ?? version.version_label,
          revisionDate: lecture?.revisionDate.value ?? '',
          language: lecture?.languageHint ?? '',
          flashPointCelsius: lecture?.flashPointCelsius.value ?? null,
          hazardStatements: lecture?.hazardStatements.value ?? [],
          euhStatements: lecture?.euhStatements.value ?? [],
          precautionaryStatements: lecture?.precautionaryStatements.value ?? [],
          substances: (lecture?.composition.rows ?? []).map((ligne) => ({
            declaredName: ligne.declaredName ?? '',
            casNumber: ligne.casNumber ?? '',
            ecNumber: ligne.ecNumber ?? '',
            concentrationMin: ligne.concentration?.min ?? null,
            concentrationMax: ligne.concentration?.max ?? null,
            concentrationExact: ligne.concentration?.exact ?? null,
            classificationText: ligne.classificationText ?? '',
            hazardStatements: ligne.hazardStatements,
            raw: ligne.raw,
            casValid: ligne.casValid,
          })),
        }}
      />
    </div>
  )
}
