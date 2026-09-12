import { describe, expect, it } from 'vitest'
import { segmentSections, segmentSubsections } from '../src/text/segmentation'

/** Fiche DEMO : texte de test, sans aucune valeur réglementaire. */
const FICHE_FR = `
FICHE DE DONNÉES DE SÉCURITÉ
DEMO Parfum d'essai

RUBRIQUE 1 : Identification
1.1 Identificateur de produit
DEMO Parfum d'essai
1.3 Renseignements concernant le fournisseur
DEMO Maison des Parfums

RUBRIQUE 2 : Identification des dangers
Classification : Skin Sens. 1, H317

RUBRIQUE 3 : Composition
3.2 Mélanges
Substance A 78-70-6 5 - 10 %

RUBRIQUE 9 : Propriétés physiques
Point éclair : 93 °C

RUBRIQUE 16 : Autres informations
Version 2.0
`

describe('segmentation en rubriques', () => {
  it('découpe une fiche française et relève les intitulés tels qu’écrits', () => {
    const resultat = segmentSections(FICHE_FR)
    expect(resultat.sections.get(1)?.heading).toBe('Identification')
    expect(resultat.sections.get(3)?.heading).toBe('Composition')
    expect(resultat.sections.get(3)?.body).toContain('78-70-6')
    expect(resultat.sections.get(16)?.body).toContain('Version 2.0')
  })

  it('signale les rubriques absentes plutôt que de les inventer', () => {
    const resultat = segmentSections(FICHE_FR)
    expect(resultat.missing).toEqual([4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15])
    expect(resultat.coverage).toBeCloseTo(5 / 16, 5)
  })

  it('reconnaît « ABSCHNITT » et « SEZIONE » aussi bien que « RUBRIQUE »', () => {
    const allemand = segmentSections('ABSCHNITT 3: Zusammensetzung\nStoff A')
    expect(allemand.sections.get(3)?.heading).toBe('Zusammensetzung')
    expect(allemand.detectedLanguageHint).toBe('de')

    const italien = segmentSections('SEZIONE 3: Composizione\nSostanza A')
    expect(italien.sections.get(3)?.heading).toBe('Composizione')
    expect(italien.detectedLanguageHint).toBe('it')
  })

  it('n’attribue aucune langue quand le mot introducteur est ambigu', () => {
    // « SECTION » s'écrit de la même façon en français et en anglais.
    expect(segmentSections('SECTION 3: Composition\nA').detectedLanguageHint).toBeNull()
  })

  it('reconnaît un en-tête sans mot introducteur', () => {
    const resultat = segmentSections('3. COMPOSITION / INFORMATIONS SUR LES COMPOSANTS\nSubstance A')
    expect(resultat.sections.get(3)?.heading).toBe('COMPOSITION / INFORMATIONS SUR LES COMPOSANTS')
  })

  it('ne prend pas une phrase numérotée pour un en-tête', () => {
    const resultat = segmentSections('3. Ce produit doit être conservé à l’abri de la chaleur.')
    expect(resultat.sections.size).toBe(0)
  })

  it('ignore un numéro hors de l’intervalle des rubriques', () => {
    const resultat = segmentSections('RUBRIQUE 17 : Inconnue\nContenu\nRUBRIQUE 0 : Autre')
    expect(resultat.sections.size).toBe(0)
  })

  it('conserve l’occurrence la plus fournie quand une rubrique est répétée', () => {
    const resultat = segmentSections(
      'RUBRIQUE 3 : Composition\nContenu détaillé de la rubrique\nRUBRIQUE 4 : Premiers secours\nA\nRUBRIQUE 3 : Composition\n',
    )
    expect(resultat.sections.get(3)?.body).toBe('Contenu détaillé de la rubrique')
  })

  it('produit exactement le même découpage pour un même document', () => {
    const premier = segmentSections(FICHE_FR)
    const second = segmentSections(FICHE_FR)
    expect([...premier.sections.keys()]).toEqual([...second.sections.keys()])
    expect(premier.coverage).toBe(second.coverage)
  })

  it('renvoie une couverture nulle sur un document vide', () => {
    const resultat = segmentSections('')
    expect(resultat.coverage).toBe(0)
    expect(resultat.missing).toHaveLength(16)
  })
})

describe('sous-rubriques', () => {
  it('découpe une rubrique en sous-rubriques numérotées', () => {
    const resultat = segmentSections(FICHE_FR)
    const sousRubriques = segmentSubsections(resultat.sections.get(1)!)
    expect(sousRubriques.map((s) => s.reference)).toEqual(['1.1', '1.3'])
    expect(sousRubriques[0]?.heading).toBe('Identificateur de produit')
    expect(sousRubriques[0]?.body).toBe("DEMO Parfum d'essai")
  })

  it('ignore une référence appartenant à une autre rubrique', () => {
    const resultat = segmentSections('RUBRIQUE 3 : Composition\n3.2 Mélanges\nA\n9.1 Aspect\nB')
    const sousRubriques = segmentSubsections(resultat.sections.get(3)!)
    expect(sousRubriques.map((s) => s.reference)).toEqual(['3.2'])
    // Le contenu de la référence étrangère reste dans le corps de la 3.2.
    expect(sousRubriques[0]?.body).toContain('9.1 Aspect')
  })
})

describe('robustesse typographique des en-têtes', () => {
  it('reconnaît le tiret cadratin employé par les textes officiels', () => {
    // Non-régression : le règlement écrit « RUBRIQUE 1 — Identification ».
    // Sans normalisation, aucun en-tête n'était reconnu.
    const resultat = segmentSections(
      'RUBRIQUE 1 — Identification de la substance\nContenu\nRUBRIQUE 2 — Identification des dangers\nAutre',
    )
    expect(resultat.sections.get(1)?.heading).toBe('Identification de la substance')
    expect(resultat.sections.get(2)?.heading).toBe('Identification des dangers')
  })

  it('reconnaît indifféremment les séparateurs employés par les fournisseurs', () => {
    for (const separateur of [':', '-', '–', '—', '.', '']) {
      const resultat = segmentSections(`RUBRIQUE 3 ${separateur} Composition\nContenu`)
      expect(resultat.sections.get(3)?.heading, separateur).toBe('Composition')
    }
  })

  it('tolère les espaces insécables autour du numéro', () => {
    const resultat = segmentSections('RUBRIQUE 3 : Composition\nContenu')
    expect(resultat.sections.get(3)?.heading).toBe('Composition')
  })
})

describe('mises en page relevées sur des fiches réelles', () => {
  it('reconnaît un en-tête dont le mot introducteur est isolé sur sa ligne', () => {
    // Non-régression : cette mise en page rendait le document entièrement
    // illisible, aucune rubrique n'étant détectée.
    const fiche = [
      'section',
      '1 Identification de la substance/du mélange et de la société',
      'Nom du produit : DEMO',
      'section',
      '3 Composition/informations sur les composants',
      'DEMO Substance A 78-70-6 5 %',
    ].join('\n')

    const resultat = segmentSections(fiche)
    expect(resultat.sections.get(1)?.heading).toBe(
      'Identification de la substance/du mélange et de la société',
    )
    expect(resultat.sections.get(3)?.body).toContain('78-70-6')
  })

  it('n’emploie les règles tolérantes que si la lecture stricte a échoué', () => {
    // Un document bien formé ne doit pas se voir appliquer des règles
    // permissives, qui prendraient une phrase numérotée pour un en-tête.
    const lignes: string[] = []
    for (let numero = 1; numero <= 16; numero += 1) {
      lignes.push(`RUBRIQUE ${numero} : Intitulé ${numero}`)
      lignes.push(`3 produits sont concernés par cette rubrique`)
    }

    const resultat = segmentSections(lignes.join('\n'))
    expect(resultat.coverage).toBe(1)
    expect(resultat.sections.get(3)?.heading).toBe('Intitulé 3')
  })

  it('ne retient la seconde passe que si elle fait mieux', () => {
    // Trop peu d'en-têtes pour conclure : aucune rubrique n'est inventée.
    const resultat = segmentSections('3 produits sont concernés.\nAutre phrase ordinaire.')
    expect(resultat.sections.size).toBe(0)
  })
})
