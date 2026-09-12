import { describe, expect, it } from 'vitest'
import {
  parseFlashPoint,
  parseProductName,
  parseRevisionDate,
  parseSupplierName,
  parseVersionLabel,
} from '../src/text/fields'

describe('date de révision', () => {
  it('lit les trois écritures courantes', () => {
    expect(parseRevisionDate('Date de révision : 12/03/2026')?.value).toBe('2026-03-12')
    expect(parseRevisionDate('Revision date: 2026-03-12')?.value).toBe('2026-03-12')
    expect(parseRevisionDate('Date de révision : 12 mars 2026')?.value).toBe('2026-03-12')
  })

  it('lit une étiquette allemande ou italienne', () => {
    expect(parseRevisionDate('Überarbeitet am: 12.03.2026')?.value).toBe('2026-03-12')
    expect(parseRevisionDate('Data di revisione: 12/03/2026')?.value).toBe('2026-03-12')
  })

  it('conserve l’extrait d’origine', () => {
    expect(parseRevisionDate('Date de révision : 12/03/2026')?.evidence).toBe('12/03/2026')
  })

  it('refuse une date impossible', () => {
    expect(parseRevisionDate('Date de révision : 31/02/2026')).toBeNull()
    expect(parseRevisionDate('Date de révision : 12/13/2026')).toBeNull()
  })

  it('refuse une année seule et une étiquette absente', () => {
    expect(parseRevisionDate('Date de révision : 2026')).toBeNull()
    expect(parseRevisionDate('Document sans date')).toBeNull()
  })
})

describe('version', () => {
  it('lit un numéro de version', () => {
    expect(parseVersionLabel('Version : 2.0')?.value).toBe('2.0')
    expect(parseVersionLabel('Version 3')?.value).toBe('3')
    expect(parseVersionLabel('Versione: 1,5')?.value).toBe('1.5')
  })

  it('refuse une version non numérique', () => {
    expect(parseVersionLabel('Version : provisoire')).toBeNull()
  })
})

describe('nom du produit et fournisseur', () => {
  it('lit le nom commercial', () => {
    expect(parseProductName('Nom commercial : DEMO Parfum d’essai')?.value).toBe(
      'DEMO Parfum d’essai',
    )
    expect(parseProductName('Product name: DEMO Test')?.value).toBe('DEMO Test')
  })

  it('lit le fournisseur', () => {
    expect(parseSupplierName('Fournisseur : DEMO Maison des Parfums')?.value).toBe(
      'DEMO Maison des Parfums',
    )
  })

  it('laisse le champ vide quand l’étiquette est absente', () => {
    expect(parseProductName('Un document sans étiquette reconnue')).toBeNull()
    expect(parseSupplierName('Un document sans étiquette reconnue')).toBeNull()
  })
})

describe('point éclair', () => {
  it('lit une valeur en degrés Celsius', () => {
    expect(parseFlashPoint("Point d'éclair : 93 °C")).toMatchObject({ value: 93, operator: null })
    expect(parseFlashPoint('Flash point: 93°C')?.value).toBe(93)
    expect(parseFlashPoint('Flammpunkt: 93 °C')?.value).toBe(93)
  })

  it('convertit les degrés Fahrenheit', () => {
    // 200 °F valent 93,33 °C.
    expect(parseFlashPoint("Point d'éclair : 200 °F")?.value).toBe(93.33)
  })

  it('conserve le comparateur : une borne n’est pas une mesure', () => {
    expect(parseFlashPoint("Point d'éclair : > 100 °C")).toMatchObject({
      value: 100,
      operator: '>',
    })
  })

  it('lit une valeur décimale à la française', () => {
    expect(parseFlashPoint("Point d'éclair : 93,5 °C")?.value).toBe(93.5)
  })

  it('refuse une unité inconnue plutôt que de la supposer', () => {
    expect(parseFlashPoint("Point d'éclair : 366 K")).toBeNull()
    expect(parseFlashPoint("Point d'éclair : non applicable")).toBeNull()
  })
})

describe('défauts relevés sur des fiches fournisseurs réelles', () => {
  it('ne prend pas un intitulé de sous-rubrique pour un nom de fournisseur', () => {
    // Non-régression : cette ligne est un titre officiel. Elle contient le mot
    // « fournisseur » et faisait relever « de la fiche de données de sécurité ».
    const texte = '1.3 Renseignements concernant le fournisseur de la fiche de données de sécurité'
    expect(parseSupplierName(texte)).toBeNull()
  })

  it('ne prend pas un intitulé de rubrique pour un nom de fournisseur', () => {
    // Non-régression : « société » figure dans l'intitulé officiel de la
    // rubrique 1, et faisait relever « /de l'entreprise ».
    const texte = "1. Identification de la substance/du mélange et de la société/de l'entreprise"
    expect(parseSupplierName(texte)).toBeNull()
    expect(parseSupplierName('RUBRIQUE 1 : Identification de la société')).toBeNull()
  })

  it('lit le fournisseur écrit sur la ligne suivant son étiquette', () => {
    // Mise en page relevée : l'étiquette est seule, la valeur suit.
    const texte = ['Fournisseur ', ': Nom : LAB SAS', 'Rue : 1 rue de la clef des champs'].join('\n')
    expect(parseSupplierName(texte)?.value).toBe('LAB SAS')
  })

  it('lit une date de version et une date d’émission', () => {
    // Écritures relevées : « Date de version », « Date d'émission ».
    expect(parseRevisionDate('Date de version: 05/11/2025')?.value).toBe('2025-11-05')
    expect(parseRevisionDate('Date d’émission: 06/08/2026')?.value).toBe('2026-08-06')
  })

  it('laisse le champ vide plutôt que de relever un morceau de titre', () => {
    // Une valeur fausse est plus nuisible qu'une valeur absente : l'écran de
    // vérification demandera la saisie.
    const fiche = [
      "1. Identification de la substance/du mélange et de la société/de l'entreprise",
      '1.3 Renseignements concernant le fournisseur de la fiche de données de sécurité',
      'Adresse : 12 rue des Artisans',
    ].join('\n')
    expect(parseSupplierName(fiche)).toBeNull()
  })
})
