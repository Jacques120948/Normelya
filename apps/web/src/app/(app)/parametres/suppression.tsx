'use client'

import { useActionState, useState } from 'react'
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui'
import { supprimerCompteAction, type EtatSuppression } from './actions'

const ETAT_INITIAL: EtatSuppression = {}

export function ZoneSuppression() {
  const [etat, action, enCours] = useActionState(supprimerCompteAction, ETAT_INITIAL)
  const [ouvert, setOuvert] = useState(false)

  return (
    <Card className="border-red-200">
      <CardHeader
        title="Supprimer mon compte"
        description="Cette opération est définitive et ne peut pas être annulée."
      />
      <CardBody className="space-y-4">
        {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

        <p className="text-sm text-[var(--color-ink-500)]">
          Votre compte, vos documents et les ateliers dont vous êtes le seul membre seront
          supprimés. Pensez à exporter ce que vous souhaitez conserver avant de continuer.
        </p>

        {ouvert ? (
          <form action={action} className="space-y-4">
            <Field
              label="Saisissez SUPPRIMER pour confirmer"
              htmlFor="confirmation"
              required
            >
              <Input
                id="confirmation"
                name="confirmation"
                autoComplete="off"
                placeholder="SUPPRIMER"
                required
              />
            </Field>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="danger" disabled={enCours}>
                {enCours ? 'Suppression…' : 'Supprimer définitivement mon compte'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOuvert(false)}>
                Annuler
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
            Supprimer mon compte
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
