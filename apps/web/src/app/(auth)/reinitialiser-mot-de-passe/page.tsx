import type { Metadata } from 'next'
import { Alert, Card, CardBody } from '@/components/ui'
import { FormulaireReinitialisation } from './formulaire'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; token_hash?: string }>
}) {
  const parametres = await searchParams
  const jeton = parametres.token ?? parametres.token_hash ?? ''

  return (
    <Card>
      <CardBody className="space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="text-xl font-semibold">Choisir un nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            Ce lien n’est utilisable qu’une seule fois.
          </p>
        </div>

        {jeton ? (
          <FormulaireReinitialisation jeton={jeton} />
        ) : (
          <Alert tone="warning">
            Ce lien est incomplet ou expiré. Demandez un nouveau lien depuis la page « Mot de passe
            oublié ».
          </Alert>
        )}
      </CardBody>
    </Card>
  )
}
