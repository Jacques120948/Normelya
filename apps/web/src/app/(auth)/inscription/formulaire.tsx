'use client'

import { useActionState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { inscriptionAction, type FormState } from '../actions'

const ETAT_INITIAL: FormState = {}

export function FormulaireInscription() {
  const [etat, action, enCours] = useActionState(inscriptionAction, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-5" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

      <Field label={fr.auth.email} htmlFor="email" error={etat.champs?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

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

      <div className="flex items-start gap-2.5">
        <input
          id="acceptTerms"
          name="acceptTerms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-[var(--color-ink-100)]"
        />
        <label htmlFor="acceptTerms" className="text-sm text-[var(--color-ink-500)]">
          {fr.auth.accepterConditions}
        </label>
      </div>
      {etat.champs?.acceptTerms ? (
        <p className="text-xs text-[var(--color-status-danger)]" role="alert">
          {etat.champs.acceptTerms}
        </p>
      ) : null}

      <Button type="submit" full disabled={enCours}>
        {enCours ? 'Création…' : fr.actions.creerCompte}
      </Button>
    </form>
  )
}
