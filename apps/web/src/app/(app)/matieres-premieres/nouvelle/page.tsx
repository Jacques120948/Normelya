import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, CardBody } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'
import { creerMatiereAction } from '../actions'
import { FormulaireMatiere } from '../formulaire'

export const metadata: Metadata = { title: 'Nouvelle matière première' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigerAtelier()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/matieres-premieres"
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          ← {fr.matieres.titre}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{fr.actions.ajouterMatiere}</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">
          Le nom et le type suffisent pour commencer. Vous ajouterez les documents ensuite.
        </p>
      </div>

      <Card>
        <CardBody className="p-6">
          <FormulaireMatiere action={creerMatiereAction} libelleBouton="Ajouter la matière" />
        </CardBody>
      </Card>
    </div>
  )
}
