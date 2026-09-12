'use client'

import { useActionState } from 'react'
import { RAW_MATERIAL_CATEGORIES, RAW_MATERIAL_CATEGORY_LABELS } from '@normelya/core'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { fr } from '@/i18n/fr'
import type { EtatMatiere } from './actions'

const ETAT_INITIAL: EtatMatiere = {}

export type ValeursMatiere = {
  name?: string
  category?: string
  supplierName?: string
  internalReference?: string
  purchasePrice?: string
  purchaseQuantity?: string
  purchaseUnit?: string
  notes?: string
}

export function FormulaireMatiere({
  action,
  valeurs = {},
  libelleBouton,
  succes,
}: {
  action: (etat: EtatMatiere, donnees: FormData) => Promise<EtatMatiere>
  valeurs?: ValeursMatiere
  libelleBouton: string
  succes?: string
}) {
  const [etat, executer, enCours] = useActionState(action, ETAT_INITIAL)
  const enregistre = !enCours && !etat.erreur && !etat.champs && succes

  return (
    <form action={executer} className="space-y-6" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}
      {enregistre ? <Alert tone="success">{succes}</Alert> : null}

      <Field label={fr.matieres.nom} htmlFor="name" error={etat.champs?.name} required>
        <Input
          id="name"
          name="name"
          defaultValue={valeurs.name}
          placeholder="Cire de soja, Parfum Fleur de coton…"
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={fr.matieres.type} htmlFor="category" error={etat.champs?.category} required>
          <Select
            id="category"
            name="category"
            defaultValue={valeurs.category ?? 'fragrance'}
            required
          >
            {RAW_MATERIAL_CATEGORIES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {RAW_MATERIAL_CATEGORY_LABELS[valeur]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={fr.matieres.fournisseur} htmlFor="supplierName">
          <Input
            id="supplierName"
            name="supplierName"
            defaultValue={valeurs.supplierName}
            placeholder="Nom du fournisseur"
          />
        </Field>
      </div>

      <Field
        label={fr.matieres.reference}
        htmlFor="internalReference"
        hint="Votre référence interne, si vous en utilisez une."
        error={etat.champs?.internalReference}
      >
        <Input
          id="internalReference"
          name="internalReference"
          defaultValue={valeurs.internalReference}
        />
      </Field>

      <fieldset className="space-y-5 rounded-[var(--radius-control)] border border-[var(--color-ink-100)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--color-ink-700)]">
          Achat (facultatif)
        </legend>
        <p className="text-xs text-[var(--color-ink-300)]">
          Ces informations servent au calcul du coût de revient. Elles n’entrent dans aucun calcul
          réglementaire.
        </p>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={`${fr.matieres.prix} (€)`} htmlFor="purchasePrice">
            <Input
              id="purchasePrice"
              name="purchasePrice"
              inputMode="decimal"
              defaultValue={valeurs.purchasePrice}
              placeholder="24,90"
            />
          </Field>

          <Field label={fr.matieres.quantite} htmlFor="purchaseQuantity">
            <Input
              id="purchaseQuantity"
              name="purchaseQuantity"
              inputMode="decimal"
              defaultValue={valeurs.purchaseQuantity}
              placeholder="1000"
            />
          </Field>

          <Field label="Unité" htmlFor="purchaseUnit">
            <Select id="purchaseUnit" name="purchaseUnit" defaultValue={valeurs.purchaseUnit ?? ''}>
              <option value="">—</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="unit">unité</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={valeurs.notes}
          className="w-full rounded-[var(--radius-control)] border border-[var(--color-ink-100)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-normelya-400)] focus:outline-none"
        />
      </Field>

      <Button type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : libelleBouton}
      </Button>
    </form>
  )
}
