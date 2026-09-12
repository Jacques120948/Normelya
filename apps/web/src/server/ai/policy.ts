/**
 * Politique de confidentialité vis-à-vis de l'intelligence artificielle.
 *
 * Règle absolue : AUCUN appel à un modèle ne reçoit une recette, une
 * formulation ou un pourcentage client. Jamais, quel que soit le fournisseur,
 * quel que soit l'engagement contractuel de celui-ci.
 *
 * Ce que l'IA peut recevoir : le texte d'un document FOURNISSEUR, c'est-à-dire
 * une fiche de données de sécurité que l'utilisateur a téléchargée depuis son
 * fournisseur. Ce document n'appartient pas au client, il circule déjà, et sa
 * lecture est la seule tâche où un modèle apporte une valeur réelle.
 *
 * Ce que l'IA ne peut jamais recevoir : le pourcentage de parfum d'une bougie,
 * la composition d'une recette, le nom commercial d'un produit du client, ou
 * tout croisement entre une matière et une quantité.
 *
 * Cette séparation n'est pas une convention de nommage : elle est appliquée
 * par le système de types (voir boundary.ts), par des contrôles d'exécution
 * (ci-dessous) et par une règle de lint interdisant d'appeler un modèle depuis
 * un autre dossier que celui-ci.
 */

export class ConfidentialityViolation extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(`Frontière de confidentialité franchie : ${reason}`)
    this.name = 'ConfidentialityViolation'
    this.reason = reason
  }
}

/**
 * Marqueurs de formulation client.
 *
 * Un texte destiné à un modèle ne doit contenir aucun de ces motifs. La
 * détection est volontairement large : mieux vaut refuser un envoi légitime que
 * laisser fuir une recette. En cas de refus, le parcours bascule sur la saisie
 * manuelle, qui reste disponible sans limite.
 */
const MARQUEURS_FORMULATION: ReadonlyArray<{ motif: RegExp; raison: string }> = [
  {
    motif: /\brecette\b/i,
    raison: 'le texte mentionne une recette',
  },
  {
    motif: /\bformulation\s+(client|produit\s+fini)\b/i,
    raison: 'le texte mentionne une formulation client',
  },
  {
    motif: /\b(taux|pourcentage|dosage)\s+de\s+parfum\b/i,
    raison: 'le texte mentionne un taux de parfum',
  },
  {
    motif: /\bproduct_version_id\b|\brecipe_id\b|\brecipe_ingredients\b/i,
    raison: 'le texte contient une référence interne de recette',
  },
]

/**
 * Contrôle d'exécution appliqué à tout contenu sortant vers un modèle.
 * Lève plutôt que de filtrer : un contenu douteux n'est pas nettoyé, il est
 * refusé, et l'incident est visible.
 */
export function assertNoCustomerFormulation(text: string): void {
  for (const { motif, raison } of MARQUEURS_FORMULATION) {
    if (motif.test(text)) {
      throw new ConfidentialityViolation(raison)
    }
  }
}

/**
 * Méthode effectivement employée pour lire un document.
 *
 * Journalisée pour chaque tentative : on doit pouvoir prouver, document par
 * document, qu'un modèle n'a été sollicité qu'en dernier recours.
 */
export const EXTRACTION_METHODS = ['pdf_text', 'ocr', 'ai_assisted', 'manual'] as const
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number]

/** Méthodes déterministes, à privilégier systématiquement. */
export const DETERMINISTIC_METHODS: readonly ExtractionMethod[] = ['pdf_text', 'ocr', 'manual']

export function isDeterministic(method: ExtractionMethod): boolean {
  return DETERMINISTIC_METHODS.includes(method)
}

/**
 * Ordre d'essai imposé : l'analyse déterministe d'abord, le modèle en dernier.
 * Un appel à un modèle sans tentative déterministe préalable est un défaut.
 */
export const EXTRACTION_ORDER: readonly ExtractionMethod[] = ['pdf_text', 'ocr', 'ai_assisted']

export function assertAiIsLastResort(attemptedMethods: readonly ExtractionMethod[]): void {
  if (!attemptedMethods.includes('ai_assisted')) return
  const deterministeTentee = attemptedMethods.some(isDeterministic)
  if (!deterministeTentee) {
    throw new ConfidentialityViolation(
      'un modèle a été sollicité sans tentative de lecture déterministe préalable',
    )
  }
}
