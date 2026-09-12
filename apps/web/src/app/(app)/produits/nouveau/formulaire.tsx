'use client'

import { useActionState } from 'react'
import {
  MARKETS,
  MARKET_LABELS,
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
} from '@normelya/core'
import { Alert, Button, Field, Input } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { creerProduitAction, type EtatProduit } from '../actions'

const ETAT_INITIAL: EtatProduit = {}

/**
 * Création d'un produit.
 *
 * Trois informations suffisent : le type, le nom, le ou les marchés visés. Le
 * poids et le contenant sont facultatifs ici parce qu'ils ne conditionnent pas
 * la recette ; ils seront exigés au moment de l'étiquette.
 */
export function FormulaireProduit() {
  const [etat, executer, enCours] = useActionState(creerProduitAction, ETAT_INITIAL)

  return (
    <form action={executer} className="space-y-6" noValidate>
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-[var(--color-ink-700)]">
          {fr.produits.type}
        </legend>
        {etat.champs?.productType ? (
          <p className="text-sm text-[var(--color-status-danger)]">{etat.champs.productType}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {PRODUCT_TYPES.map((valeur, index) => (
            <label
              key={valeur}
              className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-ink-100)] px-4 py-3 hover:bg-[var(--color-surface-sunken)] has-[:checked]:border-[var(--color-normelya-600)] has-[:checked]:bg-[var(--color-normelya-50)]"
            >
              <input
                type="radio"
                name="productType"
                value={valeur}
                defaultChecked={index === 0}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">{PRODUCT_TYPE_LABELS[valeur]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label={fr.produits.nom} htmlFor="name" error={etat.champs?.name} required>
        <Input
          id="name"
          name="name"
          placeholder="Bougie Fleur d’oranger 180 g"
          autoComplete="off"
          required
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-[var(--color-ink-700)]">
          {fr.produits.marches}
        </legend>
        <p className="text-xs text-[var(--color-ink-300)]">
          Les règles applicables diffèrent selon le marché. Sélectionnez ceux où vous mettez
          réellement le produit sur le marché.
        </p>
        {etat.champs?.markets ? (
          <p className="text-sm text-[var(--color-status-danger)]">{etat.champs.markets}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {MARKETS.map((valeur, index) => (
            <label
              key={valeur}
              className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-ink-100)] px-4 py-3 hover:bg-[var(--color-surface-sunken)] has-[:checked]:border-[var(--color-normelya-600)] has-[:checked]:bg-[var(--color-normelya-50)]"
            >
              <input
                type="checkbox"
                name="markets"
                value={valeur}
                defaultChecked={index === 0}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">{MARKET_LABELS[valeur]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={fr.produits.poidsNet}
          htmlFor="netWeightGrams"
          hint="Facultatif ici, nécessaire pour l’étiquette."
          error={etat.champs?.netWeightGrams}
        >
          <Input id="netWeightGrams" name="netWeightGrams" inputMode="decimal" placeholder="180" />
        </Field>

        <Field
          label={fr.produits.contenant}
          htmlFor="containerDescription"
          error={etat.champs?.containerDescription}
        >
          <Input
            id="containerDescription"
            name="containerDescription"
            placeholder="Verre ambré 200 ml"
          />
        </Field>
      </div>

      <Button type="submit" disabled={enCours}>
        {enCours ? 'Création…' : fr.actions.nouveauProduit}
      </Button>
    </form>
  )
}
