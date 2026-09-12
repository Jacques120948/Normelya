import { describe, expect, it } from 'vitest'
import { ENABLED_LOCALES, roleAtLeast, SUPPORTED_LOCALES } from '../src/identity'
import { STATUS_PRESENTATION } from '../src/status'

describe('rôles', () => {
  it('respecte la hiérarchie owner > admin > member > viewer', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true)
    expect(roleAtLeast('admin', 'admin')).toBe(true)
    expect(roleAtLeast('member', 'admin')).toBe(false)
    expect(roleAtLeast('viewer', 'member')).toBe(false)
    expect(roleAtLeast('viewer', 'viewer')).toBe(true)
  })
})

describe('langues', () => {
  it('prépare quatre langues mais n’en active qu’une en V1', () => {
    expect(SUPPORTED_LOCALES).toEqual(['fr', 'de', 'it', 'en'])
    expect(ENABLED_LOCALES).toEqual(['fr'])
  })
})

describe('statuts Normelya', () => {
  it('n’emploie jamais le mot « conforme » comme résultat de calcul', () => {
    for (const presentation of Object.values(STATUS_PRESENTATION)) {
      expect(presentation.label.toLowerCase()).not.toContain('conforme')
    }
  })

  it('couvre les quatre statuts du produit', () => {
    expect(STATUS_PRESENTATION.completed.label).toBe('Analyse terminée')
    expect(STATUS_PRESENTATION.needs_verification.label).toBe('Vérification nécessaire')
    expect(STATUS_PRESENTATION.action_required.label).toBe('Action requise')
    expect(STATUS_PRESENTATION.not_applicable.label).toBe('Non applicable')
  })
})
