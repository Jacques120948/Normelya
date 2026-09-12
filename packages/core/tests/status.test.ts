import { describe, expect, it } from 'vitest'
import {
  COMPUTATION_STATE_PRESENTATION,
  COMPUTATION_STATES,
  findForbiddenWords,
  isNearThreshold,
  statusForComputationState,
  STATUS_PRESENTATION,
  THRESHOLD_PROXIMITY_RATIO,
} from '../src/status'

describe('états de calcul du moteur', () => {
  it('expose exactement les trois états prévus', () => {
    expect(COMPUTATION_STATES).toEqual(['complete', 'with_assumption', 'review_required'])
  })

  it('associe à chaque état un statut d’affichage', () => {
    expect(statusForComputationState('complete')).toBe('completed')
    expect(statusForComputationState('with_assumption')).toBe('needs_verification')
    expect(statusForComputationState('review_required')).toBe('action_required')
  })

  it('n’annonce jamais un calcul avec hypothèse comme une analyse sans réserve', () => {
    expect(COMPUTATION_STATE_PRESENTATION.with_assumption.tone).toBe('warning')
    expect(COMPUTATION_STATE_PRESENTATION.with_assumption.description).toContain('hypothèses')
  })

  it('annonce clairement qu’aucun résultat n’est produit quand une donnée manque', () => {
    expect(COMPUTATION_STATE_PRESENTATION.review_required.description).toContain(
      'Aucun résultat n’est produit',
    )
  })
})

describe('proximité de seuil', () => {
  it('avertit à moins de 10 % sous le seuil', () => {
    // Seuil 1 %, valeur 0,95 % : écart relatif de 5 %.
    expect(isNearThreshold(0.95, 1)).toBe(true)
    // Écart relatif exactement égal à la limite.
    expect(isNearThreshold(0.9, 1)).toBe(true)
  })

  it('n’avertit pas au-delà de 10 % sous le seuil', () => {
    expect(isNearThreshold(0.89, 1)).toBe(false)
    expect(isNearThreshold(0.5, 1)).toBe(false)
  })

  it('n’avertit pas si le seuil est atteint ou dépassé : ce n’est plus une proximité', () => {
    expect(isNearThreshold(1, 1)).toBe(false)
    expect(isNearThreshold(1.5, 1)).toBe(false)
  })

  it('reste silencieux sur des valeurs non exploitables', () => {
    expect(isNearThreshold(Number.NaN, 1)).toBe(false)
    expect(isNearThreshold(0.5, 0)).toBe(false)
    expect(isNearThreshold(0.5, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('fixe la limite d’avertissement à 10 %', () => {
    expect(THRESHOLD_PROXIMITY_RATIO).toBe(0.1)
  })
})

describe('vocabulaire interdit', () => {
  it('détecte les affirmations interdites', () => {
    expect(findForbiddenWords('Votre produit est conforme.')).toHaveLength(1)
    expect(findForbiddenWords('Produits conformes au règlement')).toHaveLength(1)
    expect(findForbiddenWords('conformité garantie')).toHaveLength(1)
    expect(findForbiddenWords('Produit certifié Normelya')).toHaveLength(1)
  })

  it('laisse passer le substantif « conformité », qui nomme un domaine', () => {
    expect(findForbiddenWords('Centre de conformité')).toEqual([])
    expect(findForbiddenWords('La conformité simplifiée pour les créateurs.')).toEqual([])
  })

  it('laisse passer les formulations approuvées', () => {
    expect(findForbiddenWords('Analyse terminée')).toEqual([])
    expect(
      findForbiddenWords('Calcul effectué selon le règlement (CE) n° 1272/2008'),
    ).toEqual([])
    expect(findForbiddenWords('À vérifier')).toEqual([])
  })

  it('n’emploie aucun terme interdit dans ses propres libellés de statut', () => {
    for (const presentation of Object.values(STATUS_PRESENTATION)) {
      expect(findForbiddenWords(presentation.label)).toEqual([])
    }
    for (const presentation of Object.values(COMPUTATION_STATE_PRESENTATION)) {
      expect(findForbiddenWords(`${presentation.label} ${presentation.description}`)).toEqual([])
    }
  })
})
