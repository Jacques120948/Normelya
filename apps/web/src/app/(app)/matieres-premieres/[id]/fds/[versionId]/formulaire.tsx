'use client'

import { useActionState, useState } from 'react'
import type { ExtractionOutcome } from '@normelya/sds-extraction'
import { VALIDATION_STATEMENT } from '@normelya/core'
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui'
import { validerFdsAction, type EtatValidation } from '../actions'

const ETAT_INITIAL: EtatValidation = {}

type SubstanceSaisie = {
  declaredName: string
  casNumber: string
  ecNumber: string
  concentrationMin: number | null
  concentrationMax: number | null
  concentrationExact: number | null
  classificationText: string
  hazardStatements: string[]
  /** Ligne d'origine du document, montrée à l'utilisateur. */
  raw?: string
  casValid?: boolean
}

export type ValeursFds = {
  commercialName: string
  supplierName: string
  versionLabel: string
  revisionDate: string
  language: string
  flashPointCelsius: number | null
  hazardStatements: string[]
  euhStatements: string[]
  precautionaryStatements: string[]
  substances: SubstanceSaisie[]
}

/**
 * Écran de vérification.
 *
 * Chaque champ montre d'où vient la valeur proposée : l'extrait exact du
 * document. C'est ce qui permet à l'utilisateur de contrôler sans relire la
 * fiche entière, et c'est aussi ce qui rend la validation sincère.
 */
export function FormulaireVerification({
  matiereId,
  versionId,
  documentId,
  lecture,
  valeursParDefaut,
}: {
  matiereId: string
  versionId: string
  documentId: string
  lecture: ExtractionOutcome | null
  valeursParDefaut: ValeursFds
}) {
  const [etat, executer, enCours] = useActionState(
    validerFdsAction.bind(null, matiereId, versionId),
    ETAT_INITIAL,
  )
  const [valeurs, setValeurs] = useState<ValeursFds>(valeursParDefaut)

  const modifier = <K extends keyof ValeursFds>(cle: K, valeur: ValeursFds[K]) =>
    setValeurs((actuelles) => ({ ...actuelles, [cle]: valeur }))

  const modifierSubstance = (index: number, champ: keyof SubstanceSaisie, valeur: unknown) =>
    setValeurs((actuelles) => ({
      ...actuelles,
      substances: actuelles.substances.map((substance, position) =>
        position === index ? { ...substance, [champ]: valeur } : substance,
      ),
    }))

  const retirerSubstance = (index: number) =>
    setValeurs((actuelles) => ({
      ...actuelles,
      substances: actuelles.substances.filter((_, position) => position !== index),
    }))

  const ajouterSubstance = () =>
    setValeurs((actuelles) => ({
      ...actuelles,
      substances: [
        ...actuelles.substances,
        {
          declaredName: '',
          casNumber: '',
          ecNumber: '',
          concentrationMin: null,
          concentrationMax: null,
          concentrationExact: null,
          classificationText: '',
          hazardStatements: [],
        },
      ],
    }))

  // Seules les données réellement soumises sont envoyées : l'extrait source et
  // l'indicateur de validité servent à l'affichage, pas à l'enregistrement.
  const charge = {
    commercialName: valeurs.commercialName,
    supplierName: valeurs.supplierName,
    versionLabel: valeurs.versionLabel,
    revisionDate: valeurs.revisionDate,
    language: valeurs.language,
    flashPointCelsius: valeurs.flashPointCelsius,
    hazardStatements: valeurs.hazardStatements,
    euhStatements: valeurs.euhStatements,
    precautionaryStatements: valeurs.precautionaryStatements,
    substances: valeurs.substances.map((substance) => ({
      declaredName: substance.declaredName,
      casNumber: substance.casNumber,
      ecNumber: substance.ecNumber,
      concentrationMin: substance.concentrationMin,
      concentrationMax: substance.concentrationMax,
      concentrationExact: substance.concentrationExact,
      classificationText: substance.classificationText,
      hazardStatements: substance.hazardStatements,
    })),
  }

  return (
    <form action={executer} className="space-y-6">
      {etat.erreur ? <Alert tone="danger">{etat.erreur}</Alert> : null}
      {etat.champs && Object.keys(etat.champs).length > 0 ? (
        <Alert tone="danger" title="Certaines informations sont incomplètes">
          <ul className="mt-1 space-y-1">
            {Object.entries(etat.champs).map(([champ, message]) => (
              <li key={champ}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <input type="hidden" name="payload" value={JSON.stringify(charge)} />
      <input type="hidden" name="commercialName" value={valeurs.commercialName} />

      <Card>
        <CardHeader
          title="Le document"
          description="Le fichier original est conservé intact. C’est lui qui fait foi."
        />
        <CardBody>
          <a
            href={`/api/documents/${documentId}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-[var(--color-normelya-600)] underline-offset-4 hover:underline"
          >
            Ouvrir la fiche fournisseur
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Identification" />
        <CardBody className="space-y-5">
          <ChampVerifie
            label="Nom commercial"
            nom="commercialName"
            valeur={valeurs.commercialName}
            onChange={(v) => modifier('commercialName', v)}
            extrait={lecture?.productName.evidence}
            confiance={lecture?.productName.confidence}
            requis
          />
          <ChampVerifie
            label="Fournisseur"
            nom="supplierName"
            valeur={valeurs.supplierName}
            onChange={(v) => modifier('supplierName', v)}
            extrait={lecture?.supplierName.evidence}
            confiance={lecture?.supplierName.confidence}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <ChampVerifie
              label="Version"
              nom="versionLabel"
              valeur={valeurs.versionLabel}
              onChange={(v) => modifier('versionLabel', v)}
              extrait={lecture?.versionLabel.evidence}
              confiance={lecture?.versionLabel.confidence}
              requis
            />
            <ChampVerifie
              label="Date de révision"
              nom="revisionDate"
              type="date"
              valeur={valeurs.revisionDate}
              onChange={(v) => modifier('revisionDate', v)}
              extrait={lecture?.revisionDate.evidence}
              confiance={lecture?.revisionDate.confidence}
            />
          </div>
          <ChampVerifie
            label="Point d’éclair (°C)"
            nom="flashPointCelsius"
            type="number"
            valeur={valeurs.flashPointCelsius === null ? '' : String(valeurs.flashPointCelsius)}
            onChange={(v) => modifier('flashPointCelsius', v === '' ? null : Number(v))}
            extrait={lecture?.flashPointCelsius.evidence}
            confiance={lecture?.flashPointCelsius.confidence}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Composition"
          description="Les concentrations sont conservées telles que déclarées. Une plage reste une plage."
        />
        <CardBody className="space-y-5">
          {valeurs.substances.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-500)]">
              Aucune substance n’a été lue. Ajoutez celles qui figurent dans la rubrique 3 de la
              fiche.
            </p>
          ) : null}

          {valeurs.substances.map((substance, index) => (
            <fieldset
              key={index}
              className="space-y-4 rounded-[var(--radius-control)] border border-[var(--color-ink-100)] p-4"
            >
              <legend className="px-1 text-sm font-medium text-[var(--color-ink-700)]">
                Substance {index + 1}
              </legend>

              {substance.raw ? (
                <p className="rounded bg-[var(--color-surface-sunken)] px-3 py-2 font-mono text-xs text-[var(--color-ink-500)]">
                  {substance.raw}
                </p>
              ) : null}

              {substance.casNumber && substance.casValid === false ? (
                <p className="text-xs text-[var(--color-status-warning)]">
                  Ce numéro CAS ne passe pas son contrôle de cohérence. Vérifiez-le sur la fiche.
                </p>
              ) : null}

              <Field label="Nom" htmlFor={`nom-${index}`} required>
                <Input
                  id={`nom-${index}`}
                  value={substance.declaredName}
                  onChange={(e) => modifierSubstance(index, 'declaredName', e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Numéro CAS" htmlFor={`cas-${index}`}>
                  <Input
                    id={`cas-${index}`}
                    value={substance.casNumber}
                    placeholder="78-70-6"
                    onChange={(e) => modifierSubstance(index, 'casNumber', e.target.value)}
                  />
                </Field>
                <Field label="Numéro CE" htmlFor={`ce-${index}`}>
                  <Input
                    id={`ce-${index}`}
                    value={substance.ecNumber}
                    placeholder="201-134-4"
                    onChange={(e) => modifierSubstance(index, 'ecNumber', e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Min (%)" htmlFor={`min-${index}`}>
                  <Input
                    id={`min-${index}`}
                    inputMode="decimal"
                    value={substance.concentrationMin ?? ''}
                    onChange={(e) =>
                      modifierSubstance(
                        index,
                        'concentrationMin',
                        e.target.value === '' ? null : Number(e.target.value.replace(',', '.')),
                      )
                    }
                  />
                </Field>
                <Field label="Max (%)" htmlFor={`max-${index}`}>
                  <Input
                    id={`max-${index}`}
                    inputMode="decimal"
                    value={substance.concentrationMax ?? ''}
                    onChange={(e) =>
                      modifierSubstance(
                        index,
                        'concentrationMax',
                        e.target.value === '' ? null : Number(e.target.value.replace(',', '.')),
                      )
                    }
                  />
                </Field>
                <Field label="Valeur exacte (%)" htmlFor={`exact-${index}`}>
                  <Input
                    id={`exact-${index}`}
                    inputMode="decimal"
                    value={substance.concentrationExact ?? ''}
                    onChange={(e) =>
                      modifierSubstance(
                        index,
                        'concentrationExact',
                        e.target.value === '' ? null : Number(e.target.value.replace(',', '.')),
                      )
                    }
                  />
                </Field>
              </div>

              <Field
                label="Classification déclarée"
                htmlFor={`classification-${index}`}
                hint="Telle qu’écrite par le fournisseur. Normelya ne l’interprète pas à cette étape."
              >
                <Input
                  id={`classification-${index}`}
                  value={substance.classificationText}
                  onChange={(e) => modifierSubstance(index, 'classificationText', e.target.value)}
                />
              </Field>

              {substance.hazardStatements.length > 0 ? (
                <p className="text-xs text-[var(--color-ink-500)]">
                  Codes relevés : {substance.hazardStatements.join(', ')}
                </p>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => retirerSubstance(index)}
              >
                Retirer cette substance
              </Button>
            </fieldset>
          ))}

          <Button type="button" variant="secondary" size="sm" onClick={ajouterSubstance}>
            + Ajouter une substance
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-2.5">
            <input
              id="confirmed"
              name="confirmed"
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 rounded border-[var(--color-ink-100)]"
            />
            <label htmlFor="confirmed" className="text-sm font-medium text-[var(--color-ink-900)]">
              {VALIDATION_STATEMENT}
            </label>
          </div>

          <p className="text-xs text-[var(--color-ink-300)]">
            Cette confirmation est enregistrée avec votre nom, la date, et une empreinte des
            informations ci-dessus. Elle établit ce que vous avez vérifié, et quand.
          </p>

          <Button type="submit" disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Valider la fiche'}
          </Button>
        </CardBody>
      </Card>
    </form>
  )
}

/**
 * Champ accompagné de sa provenance.
 *
 * Montrer l'extrait d'où vient la valeur est ce qui distingue une vérification
 * d'une approbation à l'aveugle.
 */
function ChampVerifie({
  label,
  nom,
  valeur,
  onChange,
  extrait,
  confiance,
  type = 'text',
  requis,
}: {
  label: string
  nom: string
  valeur: string
  onChange: (valeur: string) => void
  extrait?: string | null
  confiance?: 'high' | 'medium' | 'low'
  type?: string
  requis?: boolean
}) {
  const mention =
    confiance === 'medium'
      ? 'Trouvé ailleurs que dans la rubrique attendue : à confirmer.'
      : confiance === 'low' && extrait
        ? 'Lecture incertaine : à confirmer.'
        : undefined

  return (
    <Field label={label} htmlFor={nom} required={requis} hint={mention}>
      <Input
        id={nom}
        type={type}
        value={valeur}
        required={requis}
        onChange={(e) => onChange(e.target.value)}
      />
      {extrait ? (
        <p className="mt-1 text-xs text-[var(--color-ink-300)]">
          Lu dans le document : <span className="font-mono">{extrait}</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-[var(--color-ink-300)]">
          Rien n’a été trouvé pour ce champ. Saisissez la valeur si elle figure sur la fiche.
        </p>
      )}
    </Field>
  )
}
