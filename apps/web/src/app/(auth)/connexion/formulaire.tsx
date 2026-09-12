'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Alert, Button, Field, Input } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { connexionAction, type FormState } from '../actions'

const ETAT_INITIAL: FormState = {}

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(connexionAction, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-5" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

      <Field label={fr.auth.email} htmlFor="email" error={etat.champs?.email} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(etat.champs?.email)}
        />
      </Field>

      <Field label={fr.auth.motDePasse} htmlFor="password" error={etat.champs?.password} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(etat.champs?.password)}
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/mot-de-passe-oublie"
          className="text-sm text-[var(--color-ink-500)] underline-offset-4 hover:underline"
        >
          {fr.auth.motDePasseOublie}
        </Link>
      </div>

      <Button type="submit" full disabled={enCours}>
        {enCours ? 'Connexion…' : fr.actions.seConnecter}
      </Button>
    </form>
  )
}
