import { describe, expect, it } from 'vitest'
import { REGULATORY_SOURCES } from '@normelya/regulatory-sources'
import {
  ANNEX_II_REFERENCE,
  ANNEX_II_SOURCE,
  findSection,
  findSubsection,
  SDS_SECTION_COUNT,
  SDS_SECTIONS,
  structureProvenance,
} from '../src/annexe-ii'

/**
 * Ces tests portent sur une structure relevée dans un texte officiel.
 * Ils vérifient la fidélité du relevé, jamais une règle de contenu.
 */

describe('structure de la fiche de données de sécurité', () => {
  it('comprend seize rubriques, numérotées de 1 à 16 sans trou', () => {
    expect(SDS_SECTIONS).toHaveLength(SDS_SECTION_COUNT)
    expect(SDS_SECTIONS.map((s) => s.number)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    )
  })

  it('porte les intitulés officiels des rubriques', () => {
    expect(findSection(1)?.title).toBe(
      "Identification de la substance/du mélange et de la société/de l'entreprise",
    )
    expect(findSection(2)?.title).toBe('Identification des dangers')
    expect(findSection(3)?.title).toBe('Composition/informations sur les composants')
    expect(findSection(9)?.title).toBe('Propriétés physiques et chimiques')
    expect(findSection(16)?.title).toBe('Autres informations')
  })

  it('numérote chaque sous-rubrique dans sa propre rubrique', () => {
    for (const section of SDS_SECTIONS) {
      section.subsections.forEach((sous, index) => {
        expect(sous.reference, sous.reference).toBe(`${section.number}.${index + 1}`)
      })
    }
  })

  it('donne le nombre attendu de sous-rubriques', () => {
    const attendu: Record<number, number> = {
      1: 4, 2: 3, 3: 2, 4: 3, 5: 3, 6: 4, 7: 3, 8: 2,
      9: 2, 10: 6, 11: 2, 12: 7, 13: 1, 14: 7, 15: 2, 16: 0,
    }
    for (const section of SDS_SECTIONS) {
      expect(section.subsections.length, `rubrique ${section.number}`).toBe(attendu[section.number])
    }
  })

  it('signale la particularité de la rubrique 3 sans en tirer de règle', () => {
    const rubrique3 = findSection(3)!
    expect(rubrique3.structuralNote).toContain('une seule des deux sous-rubriques')
    expect(rubrique3.subsections.map((s) => s.title)).toEqual(['Substances', 'Mélanges'])
  })

  it('retrouve une sous-rubrique par sa référence', () => {
    expect(findSubsection('1.1')?.title).toBe('Identificateur de produit')
    expect(findSubsection('3.2')?.title).toBe('Mélanges')
    expect(findSubsection('12.6')?.title).toBe('Propriétés perturbant le système endocrinien')
    expect(findSubsection('16.1')).toBeNull()
  })

  it('rattache la structure à sa source et à la version consultée', () => {
    const provenance = structureProvenance()
    expect(ANNEX_II_SOURCE).toBe('EU_REACH_1907_2006')
    expect(ANNEX_II_REFERENCE).toBe('Annexe II, partie B')
    expect(provenance.consultedVersion).toBe(REGULATORY_SOURCES.EU_REACH_1907_2006.consultedVersion)
    expect(provenance.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('n’énonce aucune règle de contenu', () => {
    // Garde-fou : ce fichier décrit une structure. Toute règle de remplissage
    // relève du moteur réglementaire et de sa validation humaine.
    const serialise = JSON.stringify(SDS_SECTIONS).toLowerCase()
    for (const interdit of ['seuil', '%', 'h3', 'euh', 'facteur m', 'si la concentration']) {
      expect(serialise, interdit).not.toContain(interdit)
    }
  })
})
