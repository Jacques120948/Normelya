'use client'

import { useActionState, useMemo, useState } from 'react'
import {
  INGREDIENT_ROLES,
  INGREDIENT_ROLE_LABELS,
  MAX_FRAGRANCE_PERCENT,
  MIN_FRAGRANCE_PERCENT,
  checkRecipeTotal,
  defaultIngredientRole,
  formatPercent,
  sumPercents,
  type IngredientRole,
  type RawMaterialCategory,
} from '@normelya/core'
import { Alert, Button, Select } from '@/components/ui'
import { fr } from '@/i18n/fr'
import { enregistrerRecetteAction, type EtatRecette } from '../actions'

const ETAT_INITIAL: EtatRecette = {}

export type MatiereSelectionnable = {
  id: string
  name: string
  category: string
  versionFdsValidee: string | null
  libelleFdsValidee: string | null
}

export type LigneRecette = {
  rawMaterialId: string
  percent: string
  role: IngredientRole
}

let compteur = 0
function nouvelleCle(): string {
  compteur += 1
  return `ligne-${compteur}`
}

/**
 * Éditeur de recette.
 *
 * Le pourcentage est un champ numérique libre : aucune valeur n'est proposée,
 * aucune n'est corrigée. Le total est calculé à la saisie avec la même
 * arithmétique que le serveur, pour que l'écart affiché soit celui qui sera
 * réellement opposé à l'enregistrement.
 */
export function EditeurRecette({
  productId,
  matieres,
  lignesInitiales,
  versionFigee,
}: {
  productId: string
  matieres: readonly MatiereSelectionnable[]
  lignesInitiales: readonly LigneRecette[]
  versionFigee: boolean
}) {
  const action = enregistrerRecetteAction.bind(null, productId)
  const [etat, executer, enCours] = useActionState(action, ETAT_INITIAL)

  const [lignes, setLignes] = useState<(LigneRecette & { cle: string })[]>(() =>
    lignesInitiales.length > 0
      ? lignesInitiales.map((ligne) => ({ ...ligne, cle: nouvelleCle() }))
      : [{ cle: nouvelleCle(), rawMaterialId: '', percent: '', role: 'wax' }],
  )

  const parId = useMemo(() => new Map(matieres.map((m) => [m.id, m])), [matieres])

  const pourcentages = lignes
    .map((ligne) => Number(ligne.percent.replace(',', '.')))
    .filter((valeur) => Number.isFinite(valeur) && valeur > 0)

  const total = sumPercents(pourcentages)
  const verdict = checkRecipeTotal(pourcentages)

  const chargeParfum = sumPercents(
    lignes
      .filter((ligne) => ligne.role === 'fragrance')
      .map((ligne) => Number(ligne.percent.replace(',', '.')))
      .filter((valeur) => Number.isFinite(valeur) && valeur > 0),
  )

  const modifier = (cle: string, champ: keyof LigneRecette, valeur: string) => {
    setLignes((actuelles) =>
      actuelles.map((ligne) => {
        if (ligne.cle !== cle) return ligne
        if (champ === 'rawMaterialId') {
          // Le rôle suit la catégorie de la matière choisie, et reste modifiable.
          const matiere = parId.get(valeur)
          return {
            ...ligne,
            rawMaterialId: valeur,
            role: matiere
              ? defaultIngredientRole(matiere.category as RawMaterialCategory)
              : ligne.role,
          }
        }
        return { ...ligne, [champ]: valeur }
      }),
    )
  }

  if (matieres.length === 0) {
    return (
      <Alert tone="info">
        {fr.produits.aucuneMatiere}{' '}
        <a href="/matieres-premieres/nouvelle" className="underline underline-offset-4">
          {fr.actions.ajouterMatiere}
        </a>
      </Alert>
    )
  }

  return (
    <form action={executer} className="space-y-5" noValidate>
      {versionFigee ? <Alert tone="warning">{fr.produits.versionFigee}</Alert> : null}
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? (
        <Alert tone="success">
          {etat.succes}
          {etat.nouvelleVersion ? ` ${fr.produits.nouvelleVersionCreee}` : ''}
        </Alert>
      ) : null}

      <ul className="space-y-3">
        {lignes.map((ligne, index) => {
          const matiere = parId.get(ligne.rawMaterialId)
          return (
            <li
              key={ligne.cle}
              className="grid gap-3 rounded-[var(--radius-control)] border border-[var(--color-ink-100)] p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
            >
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-ink-700)]">
                  {fr.produits.ingredients}
                </span>
                <Select
                  name={`ingredients[${index}][rawMaterialId]`}
                  value={ligne.rawMaterialId}
                  onChange={(evenement) =>
                    modifier(ligne.cle, 'rawMaterialId', evenement.target.value)
                  }
                >
                  <option value="">Choisir une matière…</option>
                  {matieres.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
                {matiere ? (
                  <span className="mt-1 block text-xs text-[var(--color-ink-300)]">
                    {matiere.libelleFdsValidee
                      ? `${fr.produits.fdsUtilisee} : ${matiere.libelleFdsValidee}`
                      : fr.produits.sansFds}
                  </span>
                ) : null}
                {matiere?.versionFdsValidee ? (
                  <input
                    type="hidden"
                    name={`ingredients[${index}][sdsVersionId]`}
                    value={matiere.versionFdsValidee}
                  />
                ) : null}
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-ink-700)]">
                  {fr.produits.role}
                </span>
                <Select
                  name={`ingredients[${index}][role]`}
                  value={ligne.role}
                  onChange={(evenement) => modifier(ligne.cle, 'role', evenement.target.value)}
                >
                  {INGREDIENT_ROLES.map((valeur) => (
                    <option key={valeur} value={valeur}>
                      {INGREDIENT_ROLE_LABELS[valeur]}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-[var(--color-ink-700)]">
                  {fr.produits.pourcentage} (%)
                </span>
                <input
                  name={`ingredients[${index}][percent]`}
                  value={ligne.percent}
                  onChange={(evenement) =>
                    modifier(ligne.cle, 'percent', evenement.target.value)
                  }
                  inputMode="decimal"
                  placeholder="7,5"
                  className="w-full rounded-[var(--radius-control)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-normelya-600)] focus:ring-2 focus:ring-[var(--color-normelya-100)]"
                />
              </label>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLignes((actuelles) =>
                    actuelles.length > 1
                      ? actuelles.filter((autre) => autre.cle !== ligne.cle)
                      : actuelles,
                  )
                }
                aria-label={`${fr.produits.retirerLigne} — ligne ${index + 1}`}
                disabled={lignes.length === 1}
              >
                {fr.produits.retirerLigne}
              </Button>
            </li>
          )
        })}
      </ul>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          setLignes((actuelles) => [
            ...actuelles,
            { cle: nouvelleCle(), rawMaterialId: '', percent: '', role: 'fragrance' },
          ])
        }
      >
        + {fr.produits.ajouterLigne}
      </Button>

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] bg-[var(--color-surface-sunken)] px-4 py-3"
        aria-live="polite"
      >
        <p className="text-sm">
          <span className="font-medium">{fr.produits.total} : </span>
          <span className={verdict.valid ? 'text-[var(--color-status-success)]' : undefined}>
            {formatPercent(total, 3)}
          </span>
          {verdict.valid ? null : (
            <span className="ml-2 text-[var(--color-ink-500)]">{verdict.message}</span>
          )}
        </p>
        <p className="text-sm text-[var(--color-ink-500)]">
          {fr.produits.tauxParfum} : {formatPercent(chargeParfum, 3)}
        </p>
      </div>

      {chargeParfum > 0 && chargeParfum < MIN_FRAGRANCE_PERCENT ? (
        <Alert tone="warning">
          Le taux de parfum cumulé est inférieur à {formatPercent(MIN_FRAGRANCE_PERCENT, 1)}.
        </Alert>
      ) : null}
      {chargeParfum > MAX_FRAGRANCE_PERCENT ? (
        <Alert tone="warning">
          Le taux de parfum cumulé dépasse {MAX_FRAGRANCE_PERCENT} %. Vérifiez votre saisie.
        </Alert>
      ) : null}

      <Button type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : fr.actions.enregistrer}
      </Button>
    </form>
  )
}
