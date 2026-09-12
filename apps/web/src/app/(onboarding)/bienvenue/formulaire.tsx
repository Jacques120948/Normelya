'use client'

import { useActionState } from 'react'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { onboardingAction, type EtatOnboarding } from './actions'

const ETAT_INITIAL: EtatOnboarding = {}

export function FormulaireOnboarding({ emailParDefaut }: { emailParDefaut: string }) {
  const [etat, action, enCours] = useActionState(onboardingAction, ETAT_INITIAL)

  return (
    <form action={action} className="space-y-6" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={fr.onboarding.prenom} htmlFor="firstName" error={etat.champs?.firstName} required>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
        </Field>

        <Field label={fr.onboarding.nom} htmlFor="lastName" error={etat.champs?.lastName} required>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
        </Field>
      </div>

      <Field
        label={fr.onboarding.nomAtelier}
        htmlFor="organizationName"
        error={etat.champs?.organizationName}
        required
      >
        <Input id="organizationName" name="organizationName" autoComplete="organization" required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={fr.onboarding.pays} htmlFor="country" error={etat.champs?.country} required>
          <Select id="country" name="country" defaultValue="FR" required>
            <option value="FR">France</option>
            <option value="CH">Suisse</option>
          </Select>
        </Field>

        <Field
          label={fr.onboarding.fabrication}
          htmlFor="activity"
          error={etat.champs?.activity}
          required
        >
          <Select id="activity" name="activity" defaultValue="candles" required>
            <option value="candles">{fr.onboarding.bougies}</option>
            <option value="wax_melts">{fr.onboarding.fondants}</option>
            <option value="both">{fr.onboarding.lesDeux}</option>
          </Select>
        </Field>
      </div>

      <Field
        label={fr.onboarding.adresse}
        htmlFor="addressLine1"
        error={etat.champs?.addressLine1}
        required
      >
        <Input id="addressLine1" name="addressLine1" autoComplete="address-line1" required />
      </Field>

      <Field label={fr.onboarding.complementAdresse} htmlFor="addressLine2">
        <Input id="addressLine2" name="addressLine2" autoComplete="address-line2" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={fr.onboarding.codePostal}
          htmlFor="postalCode"
          error={etat.champs?.postalCode}
          required
        >
          <Input id="postalCode" name="postalCode" autoComplete="postal-code" required />
        </Field>

        <Field label={fr.onboarding.ville} htmlFor="city" error={etat.champs?.city} required>
          <Input id="city" name="city" autoComplete="address-level2" required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={fr.onboarding.emailContact}
          htmlFor="contactEmail"
          error={etat.champs?.contactEmail}
          required
        >
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={emailParDefaut}
            required
          />
        </Field>

        <Field
          label={fr.onboarding.telephone}
          htmlFor="contactPhone"
          hint={fr.onboarding.telephoneFacultatif}
          error={etat.champs?.contactPhone}
        >
          <Input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" />
        </Field>
      </div>

      <Button type="submit" full disabled={enCours}>
        {enCours ? 'Configuration…' : fr.onboarding.acceder}
      </Button>
    </form>
  )
}
