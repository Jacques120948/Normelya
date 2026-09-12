import type { ExtractionOutcome } from '../text/pipeline'

/**
 * Mesure du taux de réussite de la lecture automatique.
 *
 * Objectif de la phase 3 : savoir quels formats de fiches passent en lecture
 * automatique et lesquels basculent en saisie manuelle. Ce module produit cette
 * mesure ; il ne l'estime jamais. Sans corpus, il ne renvoie rien.
 */

export const MEASURED_FIELDS = [
  'productName',
  'supplierName',
  'revisionDate',
  'versionLabel',
  'flashPointCelsius',
  'hazardStatements',
  'composition',
] as const
export type MeasuredField = (typeof MEASURED_FIELDS)[number]

/** Verdict de lecture pour une fiche. */
export type ReadingVerdict =
  /** Tout le nécessaire a été lu : l'utilisateur n'a qu'à contrôler. */
  | 'automatic'
  /** L'essentiel est lu, quelques champs restent à compléter. */
  | 'light_review'
  /** La lecture n'a pas abouti : saisie manuelle. */
  | 'manual_entry'

export type SheetMeasurement = {
  /** Identifiant du document dans le corpus, jamais son contenu. */
  documentRef: string
  /** Fournisseur déclaré, ou « inconnu ». */
  supplier: string
  verdict: ReadingVerdict
  fieldsFound: MeasuredField[]
  fieldsMissing: MeasuredField[]
  compositionRowCount: number
  sectionCoverage: number
  issueCount: number
  /** Méthode ayant abouti : texte du PDF, reconnaissance optique, ou modèle. */
  method: 'pdf_text' | 'ocr' | 'ai_assisted' | 'manual'
}

/** Champs sans lesquels aucune analyse ultérieure n'est possible. */
const CHAMPS_INDISPENSABLES: readonly MeasuredField[] = ['productName', 'composition']

export function measureSheet(input: {
  documentRef: string
  outcome: ExtractionOutcome
  method: SheetMeasurement['method']
}): SheetMeasurement {
  const { outcome } = input

  const presence: Record<MeasuredField, boolean> = {
    productName: outcome.productName.value !== null,
    supplierName: outcome.supplierName.value !== null,
    revisionDate: outcome.revisionDate.value !== null,
    versionLabel: outcome.versionLabel.value !== null,
    flashPointCelsius: outcome.flashPointCelsius.value !== null,
    hazardStatements: outcome.hazardStatements.value !== null,
    composition: outcome.composition.rows.length > 0,
  }

  const fieldsFound = MEASURED_FIELDS.filter((champ) => presence[champ])
  const fieldsMissing = MEASURED_FIELDS.filter((champ) => !presence[champ])

  return {
    documentRef: input.documentRef,
    supplier: outcome.supplierName.value ?? 'inconnu',
    verdict: verdict(presence, fieldsFound.length),
    fieldsFound: [...fieldsFound],
    fieldsMissing: [...fieldsMissing],
    compositionRowCount: outcome.composition.rows.length,
    sectionCoverage: outcome.segmentation.coverage,
    issueCount: outcome.issues.length,
    method: input.method,
  }
}

function verdict(
  presence: Record<MeasuredField, boolean>,
  nombreTrouves: number,
): ReadingVerdict {
  // Sans les champs indispensables, la lecture n'a pas abouti, quel que soit le
  // reste : une fiche sans composition ne sert à rien.
  if (!CHAMPS_INDISPENSABLES.every((champ) => presence[champ])) return 'manual_entry'
  if (nombreTrouves === MEASURED_FIELDS.length) return 'automatic'
  return 'light_review'
}

export type SupplierStats = {
  supplier: string
  sheets: number
  automatic: number
  lightReview: number
  manualEntry: number
  /** Part des fiches lues sans saisie manuelle, entre 0 et 1. */
  successRate: number
}

export type CorpusReport = {
  sheets: number
  byVerdict: Record<ReadingVerdict, number>
  byField: Record<MeasuredField, { found: number; rate: number }>
  bySupplier: SupplierStats[]
  byMethod: Record<SheetMeasurement['method'], number>
  /** Part des fiches lues sans saisie manuelle, entre 0 et 1. */
  overallSuccessRate: number
  /** Part des fiches ayant nécessité un modèle de langage. */
  aiFallbackRate: number
}

/**
 * Agrège les mesures d'un corpus.
 *
 * Sur un corpus vide, tous les taux valent 0 et `sheets` vaut 0 : aucune
 * statistique n'est inventée pour donner l'illusion d'une mesure.
 */
export function buildCorpusReport(mesures: readonly SheetMeasurement[]): CorpusReport {
  const byVerdict: Record<ReadingVerdict, number> = {
    automatic: 0,
    light_review: 0,
    manual_entry: 0,
  }
  const byMethod: Record<SheetMeasurement['method'], number> = {
    pdf_text: 0,
    ocr: 0,
    ai_assisted: 0,
    manual: 0,
  }
  const comptesChamps = new Map<MeasuredField, number>()
  const parFournisseur = new Map<string, SupplierStats>()

  for (const mesure of mesures) {
    byVerdict[mesure.verdict] += 1
    byMethod[mesure.method] += 1

    for (const champ of mesure.fieldsFound) {
      comptesChamps.set(champ, (comptesChamps.get(champ) ?? 0) + 1)
    }

    const stats = parFournisseur.get(mesure.supplier) ?? {
      supplier: mesure.supplier,
      sheets: 0,
      automatic: 0,
      lightReview: 0,
      manualEntry: 0,
      successRate: 0,
    }
    stats.sheets += 1
    if (mesure.verdict === 'automatic') stats.automatic += 1
    if (mesure.verdict === 'light_review') stats.lightReview += 1
    if (mesure.verdict === 'manual_entry') stats.manualEntry += 1
    parFournisseur.set(mesure.supplier, stats)
  }

  for (const stats of parFournisseur.values()) {
    stats.successRate = stats.sheets === 0 ? 0 : (stats.automatic + stats.lightReview) / stats.sheets
  }

  const total = mesures.length
  const byField = {} as CorpusReport['byField']
  for (const champ of MEASURED_FIELDS) {
    const trouves = comptesChamps.get(champ) ?? 0
    byField[champ] = { found: trouves, rate: total === 0 ? 0 : trouves / total }
  }

  return {
    sheets: total,
    byVerdict,
    byField,
    bySupplier: [...parFournisseur.values()].sort((a, b) => b.sheets - a.sheets),
    byMethod,
    overallSuccessRate:
      total === 0 ? 0 : (byVerdict.automatic + byVerdict.light_review) / total,
    aiFallbackRate: total === 0 ? 0 : byMethod.ai_assisted / total,
  }
}

/** Rendu lisible du rapport, destiné au terminal et à la documentation. */
export function formatCorpusReport(rapport: CorpusReport): string {
  if (rapport.sheets === 0) {
    return [
      'Aucune fiche mesurée.',
      '',
      'Le corpus est absent ou vide. Aucun taux de réussite ne peut être établi.',
      'Déposez les fiches dans fixtures-fds/ puis relancez la mesure.',
    ].join('\n')
  }

  const pourcent = (valeur: number) => `${(valeur * 100).toFixed(1).replace('.', ',')} %`
  const lignes: string[] = []

  lignes.push(`Fiches mesurées : ${rapport.sheets}`)
  lignes.push('')
  lignes.push('Verdict de lecture')
  lignes.push(`  lecture automatique   ${rapport.byVerdict.automatic}`)
  lignes.push(`  vérification légère   ${rapport.byVerdict.light_review}`)
  lignes.push(`  saisie manuelle       ${rapport.byVerdict.manual_entry}`)
  lignes.push(`  taux de réussite      ${pourcent(rapport.overallSuccessRate)}`)
  lignes.push('')
  lignes.push('Taux de lecture par champ')
  for (const champ of MEASURED_FIELDS) {
    const stats = rapport.byField[champ]
    lignes.push(`  ${champ.padEnd(20)} ${pourcent(stats.rate)} (${stats.found}/${rapport.sheets})`)
  }
  lignes.push('')
  lignes.push('Par fournisseur')
  for (const stats of rapport.bySupplier) {
    lignes.push(
      `  ${stats.supplier.padEnd(30).slice(0, 30)} ${stats.sheets} fiche(s), réussite ${pourcent(stats.successRate)}`,
    )
  }
  lignes.push('')
  lignes.push('Méthode ayant abouti')
  lignes.push(`  texte du PDF          ${rapport.byMethod.pdf_text}`)
  lignes.push(`  reconnaissance optique ${rapport.byMethod.ocr}`)
  lignes.push(`  assistance par modèle  ${rapport.byMethod.ai_assisted}`)
  lignes.push(`  saisie manuelle        ${rapport.byMethod.manual}`)
  lignes.push(`  recours au modèle      ${pourcent(rapport.aiFallbackRate)}`)

  return lignes.join('\n')
}
