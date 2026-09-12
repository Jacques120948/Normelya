'use client'

import { useActionState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { reinitialiserMotDePasseAction, type FormState } from '../actions'

const ETAT_INITIAL: FormState = {}

export function FormulaireReinitialisation({ jeton }: { jeton: string }) {
  const [etat, action, enCours] = useActionState(reinitialiserMotDePasseAction, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-5" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}
      <input type="hidden" name="token" value={jeton} />

      <Field
        label={fr.auth.motDePasse}
        htmlFor="password"
        hint={fr.auth.motDePasseAide}
        error={etat.champs?.password}
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </Field>

      <Field
        label={fr.auth.confirmerMotDePasse}
        htmlFor="passwordConfirmation"
        error={etat.champs?.passwordConfirmation}
        required
      >
        <Input
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </Field>

      <Button type="submit" full disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
      </Button>
    </form>
  )
}
