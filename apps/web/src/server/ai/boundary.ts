import {
  assertAiIsLastResort,
  assertNoCustomerFormulation,
  ConfidentialityViolation,
  type ExtractionMethod,
} from './policy'

/**
 * Frontière de code entre Normelya et tout fournisseur d'intelligence
 * artificielle.
 *
 * Ce fichier est le SEUL endroit de l'application autorisé à composer un
 * contenu destiné à un modèle. La règle est appliquée par le lint : aucun
 * module hors de `src/server/ai/` ne peut importer un client de modèle.
 *
 * Le verrou principal est cependant dans les types. Un modèle ne reçoit qu'une
 * valeur de type `SupplierDocumentText`, et ce type ne peut être fabriqué que
 * par `fromSupplierDocument()`, qui exige la preuve que le texte provient d'un
 * document fournisseur déposé. Aucune chaîne de caractères ordinaire, et donc
 * aucune recette, ne peut être passée par inadvertance.
 */

declare const supplierDocumentBrand: unique symbol

/** Texte issu d'un document fournisseur, seul contenu transmissible à un modèle. */
export type SupplierDocumentText = {
  readonly text: string
  readonly documentId: string
  readonly sha256: string
  readonly [supplierDocumentBrand]: 'supplier-document'
}

export type SupplierDocumentOrigin = {
  /** Identifiant du document déposé par l'utilisateur. */
  documentId: string
  /** Empreinte du fichier original, preuve qu'il s'agit bien de ce document. */
  sha256: string
  /** Type du document en base. Seule une FDS fournisseur est admissible. */
  kind: string
}

/** Seuls ces types de documents peuvent être soumis à un modèle. */
const TYPES_FOURNISSEUR_ADMISSIBLES = new Set(['sds', 'ifra', 'allergen_declaration'])

/**
 * Fabrique l'unique valeur qu'un modèle peut recevoir.
 *
 * Retourne null plutôt que de lever : un document non admissible n'est pas une
 * erreur de programmation, c'est un cas normal qui bascule sur la saisie
 * manuelle.
 */
export function fromSupplierDocument(
  origin: SupplierDocumentOrigin,
  text: string,
): SupplierDocumentText | null {
  if (!TYPES_FOURNISSEUR_ADMISSIBLES.has(origin.kind)) return null
  if (!/^[0-9a-f]{64}$/.test(origin.sha256)) return null
  if (text.trim().length === 0) return null

  // Dernier filet : même un document fournisseur ne doit pas contenir de
  // formulation client. Si c'est le cas, on ne l'envoie pas.
  assertNoCustomerFormulation(text)

  return {
    text,
    documentId: origin.documentId,
    sha256: origin.sha256,
  } as SupplierDocumentText
}

/**
 * Port d'un fournisseur d'extraction assistée.
 *
 * La signature impose le type marqué : il est impossible d'écrire une
 * implémentation qui accepterait autre chose.
 */
export interface AiExtractionProvider {
  readonly name: string
  readonly model: string
  extract(input: SupplierDocumentText): Promise<{ payload: unknown; tokenCost: number }>
}

/**
 * Vérification structurelle à l'exécution.
 *
 * Le type marqué protège à la compilation, mais une valeur peut toujours être
 * forgée par une assertion de type ou franchir une frontière non typée (JSON,
 * appel dynamique). Ce contrôle refuse tout ce qui n'a pas exactement la forme
 * produite par `fromSupplierDocument`.
 */
function assertIsSupplierDocument(value: unknown): asserts value is SupplierDocumentText {
  const candidat = value as Partial<SupplierDocumentText> | null
  if (
    typeof candidat !== 'object' ||
    candidat === null ||
    typeof candidat.text !== 'string' ||
    typeof candidat.documentId !== 'string' ||
    typeof candidat.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(candidat.sha256)
  ) {
    throw new ConfidentialityViolation(
      "le contenu transmis n'est pas un document fournisseur vérifiable",
    )
  }
}

export type ExtractionAttempt = {
  method: ExtractionMethod
  succeeded: boolean
}

export type AssistedExtractionResult = {
  payload: unknown
  tokenCost: number
  model: string
  method: ExtractionMethod
}

/**
 * Appel assisté par modèle.
 *
 * Trois conditions cumulatives, vérifiées à l'exécution :
 *   1. l'assistance est activée pour cette organisation ;
 *   2. au moins une lecture déterministe a déjà été tentée ;
 *   3. le contenu transmis est un document fournisseur validé par le type.
 *
 * Retourne null quand l'assistance est indisponible : l'appelant poursuit alors
 * en saisie manuelle, qui reste possible sans limite.
 */
export async function extractWithAssistance(input: {
  provider: AiExtractionProvider | null
  document: SupplierDocumentText
  previousAttempts: readonly ExtractionAttempt[]
  aiEnabled: boolean
}): Promise<AssistedExtractionResult | null> {
  if (!input.aiEnabled || !input.provider) return null

  // Premier verrou : la valeur transmise a-t-elle bien été produite par
  // fromSupplierDocument ? Une chaîne forgée est refusée ici.
  assertIsSupplierDocument(input.document)

  const methodesTentees = input.previousAttempts.map((attempt) => attempt.method)
  assertAiIsLastResort([...methodesTentees, 'ai_assisted'])

  // Contrôle redondant avec fromSupplierDocument, volontairement conservé :
  // c'est le dernier point avant la sortie du réseau.
  assertNoCustomerFormulation(input.document.text)

  const resultat = await input.provider.extract(input.document)

  return {
    payload: resultat.payload,
    tokenCost: resultat.tokenCost,
    model: input.provider.model,
    method: 'ai_assisted',
  }
}
