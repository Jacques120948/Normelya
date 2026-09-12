'use client'

import { useActionState } from 'react'
import { Alert, Button, Field } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { importerFdsAction, type EtatImport } from './actions'

const ETAT_INITIAL: EtatImport = {}

export function FormulaireImport({ matiereId }: { matiereId: string }) {
  const [etat, executer, enCours] = useActionState(
    importerFdsAction.bind(null, matiereId),
    ETAT_INITIAL,
  )

  return (
    <form action={executer} className="space-y-4">
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

      <Field
        label={fr.actions.importerFds}
        htmlFor="document"
        hint="Fichier PDF, 20 Mo maximum. Le document original est conservé intact."
      >
        <input
          id="document"
          name="document"
          type="file"
          accept="application/pdf"
          required
          className="block w-full text-sm text-[var(--color-ink-700)] file:mr-3 file:rounded-[var(--radius-control)] file:border-0 file:bg-[var(--color-normelya-600)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </Field>

      <Button type="submit" disabled={enCours}>
        {enCours ? 'Lecture du document…' : 'Importer et vérifier'}
      </Button>
    </form>
  )
}
