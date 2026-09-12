import { describe, expect, it, vi } from 'vitest'
import {
  extractWithAssistance,
  fromSupplierDocument,
  type AiExtractionProvider,
  type SupplierDocumentText,
} from '../boundary'
import {
  assertAiIsLastResort,
  assertNoCustomerFormulation,
  ConfidentialityViolation,
  isDeterministic,
} from '../policy'

const SHA = 'a'.repeat(64)

function fournisseurFactice() {
  const recus: SupplierDocumentText[] = []
  const provider: AiExtractionProvider = {
    name: 'test',
    model: 'modele-test',
    extract: async (input) => {
      recus.push(input)
      return { payload: { ok: true }, tokenCost: 120 }
    },
  }
  return { provider, recus }
}

describe('frontière de confidentialité', () => {
  describe('construction du contenu transmissible', () => {
    it('accepte le texte d’une fiche de données de sécurité fournisseur', () => {
      const document = fromSupplierDocument(
        { documentId: 'doc-1', sha256: SHA, kind: 'sds' },
        'RUBRIQUE 3 : Composition / informations sur les composants',
      )
      expect(document).not.toBeNull()
      expect(document!.documentId).toBe('doc-1')
    })

    it('refuse un document qui n’est pas un document fournisseur', () => {
      for (const kind of ['label', 'analysis_report', 'product_sds', 'other']) {
        expect(
          fromSupplierDocument({ documentId: 'doc-1', sha256: SHA, kind }, 'texte'),
        ).toBeNull()
      }
    })

    it('refuse un document sans empreinte valide', () => {
      expect(
        fromSupplierDocument({ documentId: 'doc-1', sha256: 'court', kind: 'sds' }, 'texte'),
      ).toBeNull()
    })

    it('refuse un texte vide', () => {
      expect(
        fromSupplierDocument({ documentId: 'doc-1', sha256: SHA, kind: 'sds' }, '   '),
      ).toBeNull()
    })

    it('refuse un document fournisseur contenant une formulation client', () => {
      expect(() =>
        fromSupplierDocument(
          { documentId: 'doc-1', sha256: SHA, kind: 'sds' },
          'Recette : cire 91 %, parfum 9 %',
        ),
      ).toThrow(ConfidentialityViolation)
    })
  })

  describe('détection des formulations client', () => {
    it('refuse tout texte portant un marqueur de recette', () => {
      const interdits = [
        'Ma recette de bougie',
        'formulation client confidentielle',
        'taux de parfum : 9 %',
        'dosage de parfum retenu',
        'recipe_ingredients',
        'product_version_id = 42',
      ]
      for (const texte of interdits) {
        expect(() => assertNoCustomerFormulation(texte), texte).toThrow(ConfidentialityViolation)
      }
    })

    it('laisse passer le contenu normal d’une fiche fournisseur', () => {
      const extraits = [
        'RUBRIQUE 3 : Composition / informations sur les composants',
        'Linalool, CAS 78-70-6, 5 - 10 %',
        'Point d’éclair : 93 °C',
        'Skin Sens. 1, H317',
      ]
      for (const texte of extraits) {
        expect(() => assertNoCustomerFormulation(texte), texte).not.toThrow()
      }
    })

    it('nomme la raison du refus, pour que l’incident soit exploitable', () => {
      try {
        assertNoCustomerFormulation('taux de parfum : 9 %')
        throw new Error('aurait dû échouer')
      } catch (erreur) {
        expect(erreur).toBeInstanceOf(ConfidentialityViolation)
        expect((erreur as ConfidentialityViolation).reason).toContain('taux de parfum')
      }
    })
  })

  describe('ordre d’essai des méthodes', () => {
    it('classe correctement les méthodes déterministes', () => {
      expect(isDeterministic('pdf_text')).toBe(true)
      expect(isDeterministic('ocr')).toBe(true)
      expect(isDeterministic('manual')).toBe(true)
      expect(isDeterministic('ai_assisted')).toBe(false)
    })

    it('refuse un appel de modèle sans lecture déterministe préalable', () => {
      expect(() => assertAiIsLastResort(['ai_assisted'])).toThrow(ConfidentialityViolation)
    })

    it('accepte un appel de modèle après une tentative déterministe', () => {
      expect(() => assertAiIsLastResort(['pdf_text', 'ai_assisted'])).not.toThrow()
      expect(() => assertAiIsLastResort(['pdf_text', 'ocr', 'ai_assisted'])).not.toThrow()
    })

    it('ne dit rien quand aucun modèle n’est sollicité', () => {
      expect(() => assertAiIsLastResort(['pdf_text'])).not.toThrow()
      expect(() => assertAiIsLastResort([])).not.toThrow()
    })
  })

  describe('appel assisté', () => {
    const document = fromSupplierDocument(
      { documentId: 'doc-1', sha256: SHA, kind: 'sds' },
      'RUBRIQUE 3 : Composition',
    )!

    it('ne sollicite aucun modèle quand l’assistance est désactivée', async () => {
      const { provider, recus } = fournisseurFactice()
      const resultat = await extractWithAssistance({
        provider,
        document,
        previousAttempts: [{ method: 'pdf_text', succeeded: false }],
        aiEnabled: false,
      })
      expect(resultat).toBeNull()
      expect(recus).toHaveLength(0)
    })

    it('ne sollicite aucun modèle quand aucun fournisseur n’est configuré', async () => {
      const resultat = await extractWithAssistance({
        provider: null,
        document,
        previousAttempts: [{ method: 'pdf_text', succeeded: false }],
        aiEnabled: true,
      })
      expect(resultat).toBeNull()
    })

    it('transmet uniquement le document fournisseur et journalise la méthode', async () => {
      const { provider, recus } = fournisseurFactice()
      const resultat = await extractWithAssistance({
        provider,
        document,
        previousAttempts: [{ method: 'pdf_text', succeeded: false }],
        aiEnabled: true,
      })

      expect(resultat).toMatchObject({ method: 'ai_assisted', model: 'modele-test', tokenCost: 120 })
      expect(recus).toHaveLength(1)
      expect(recus[0]!.documentId).toBe('doc-1')
      expect(recus[0]!.text).toBe('RUBRIQUE 3 : Composition')
    })

    it('refuse d’appeler le modèle en premier recours', async () => {
      const { provider, recus } = fournisseurFactice()
      await expect(
        extractWithAssistance({
          provider,
          document,
          previousAttempts: [],
          aiEnabled: true,
        }),
      ).rejects.toThrow(ConfidentialityViolation)
      expect(recus).toHaveLength(0)
    })
  })

  describe('étanchéité du type', () => {
    it('n’accepte pas une chaîne ordinaire à la place d’un document fournisseur', async () => {
      const { provider } = fournisseurFactice()
      const recetteClient = 'cire 91 %, parfum 9 %'

      // Le compilateur refuse déjà ce code : le test vérifie qu'à l'exécution
      // aussi, une valeur forgée ne franchit pas la frontière.
      const appel = extractWithAssistance({
        provider,
        document: recetteClient as unknown as SupplierDocumentText,
        previousAttempts: [{ method: 'pdf_text', succeeded: false }],
        aiEnabled: true,
      })

      await expect(appel).rejects.toThrow()
    })
  })
})

describe('aucun secret de formulation dans les journaux', () => {
  it('ne consigne jamais le texte transmis', async () => {
    const journal = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { provider } = fournisseurFactice()
    const document = fromSupplierDocument(
      { documentId: 'doc-1', sha256: SHA, kind: 'sds' },
      'RUBRIQUE 3',
    )!

    await extractWithAssistance({
      provider,
      document,
      previousAttempts: [{ method: 'pdf_text', succeeded: false }],
      aiEnabled: true,
    })

    expect(journal).not.toHaveBeenCalled()
    journal.mockRestore()
  })
})
