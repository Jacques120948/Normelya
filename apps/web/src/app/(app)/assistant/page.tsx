import type { Metadata } from 'next'
import { Alert, Card, CardBody } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { exigerAtelier } from '@/server/security/guard'

export const metadata: Metadata = { title: 'Assistant Normelya' }
export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigerAtelier()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{fr.navigation.assistant}</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">
          Pour comprendre vos résultats, pas pour les produire.
        </p>
      </header>

      <Card>
        <CardBody className="space-y-4 p-6">
          <Alert tone="info" title="L’assistant arrive après le moteur réglementaire">
            Il ne peut expliquer que des résultats existants. Tant qu’aucune analyse n’est
            produite, il n’aurait rien à expliquer.
          </Alert>

          <div className="rounded-[var(--radius-control)] border border-[var(--color-ink-100)] p-4">
            <p className="text-sm font-medium">Ce que l’assistant fera</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-500)]">
              <li>· expliquer pourquoi une mention apparaît sur votre étiquette ;</li>
              <li>· traduire un terme réglementaire en langage courant ;</li>
              <li>· indiquer quelle information manque et où la trouver.</li>
            </ul>

            <p className="mt-4 text-sm font-medium">Ce qu’il ne fera jamais</p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-500)]">
              <li>· modifier un résultat du moteur réglementaire ;</li>
              <li>· décider d’une classification, d’un seuil ou d’un pictogramme ;</li>
              <li>· remplacer un avis d’expert lorsque celui-ci est nécessaire.</li>
            </ul>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
