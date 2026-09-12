import Link from 'next/link'
import { Alert, Button, Card, CardBody } from '@/components/ui'

/**
 * Section annoncée dans la navigation mais pas encore développée.
 *
 * Plutôt qu'une page vide ou une erreur, on dit franchement où en est le
 * développement et ce qui est déjà utilisable. Même exigence d'honnêteté que
 * pour les résultats réglementaires.
 */
export function AVenir({
  titre,
  description,
  etape,
  disponibleMaintenant,
}: {
  titre: string
  description: string
  etape: string
  disponibleMaintenant?: { libelle: string; href: string }
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">{titre}</h1>
        <p className="mt-1 text-[var(--color-ink-500)]">{description}</p>
      </header>

      <Card>
        <CardBody className="space-y-4 p-6">
          <Alert tone="info" title="Cette section arrive bientôt">
            {etape}
          </Alert>

          {disponibleMaintenant ? (
            <div>
              <p className="text-sm text-[var(--color-ink-500)]">
                En attendant, vous pouvez déjà avancer ici :
              </p>
              <Link href={disponibleMaintenant.href} className="mt-3 inline-block">
                <Button variant="secondary">{disponibleMaintenant.libelle}</Button>
              </Link>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
