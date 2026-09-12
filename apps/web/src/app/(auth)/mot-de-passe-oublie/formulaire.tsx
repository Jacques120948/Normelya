'use client'

import { useActionState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { motDePasseOublieAction, type FormState } from '../actions'

const ETAT_INITIAL: FormState = {}

export function FormulaireMotDePasseOublie() {
  const [etat, action, enCours] = useActionState(motDePasseOublieAction, ETAT_INITIAL)

  // La confirmation est volontairement identique que l'adresse existe ou non.
  if (etat.succes === 'envoye') {
    return <Alert tone="success">{fr.auth.reinitialisationEnvoyee}</Alert>
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

      <Field label={fr.auth.email} htmlFor="email" error={etat.champs?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Button type="submit" full disabled={enCours}>
        {enCours ? 'Envoi…' : fr.auth.lienReinitialisation}
      </Button>
    </form>
  )
}
