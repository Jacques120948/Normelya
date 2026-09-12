import { describe, expect, it } from 'vitest'
import { access, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractTextFromPdf } from '@normelya/sds-extraction/pdf'
import { segmentSections } from '@normelya/sds-extraction'
import { SDS_SECTIONS } from '../src/annexe-ii'

/**
 * Concordance entre la structure codée et le texte officiel.
 *
 * Ce test lit le règlement lui-même, tel qu'il est conservé dans
 * sources-reglementaires/, et vérifie que les seize rubriques déclarées dans le
 * code correspondent à celles du sommaire de l'annexe II.
 *
 * C'est la garantie que la structure n'a pas été écrite de mémoire, et qu'une
 * modification ultérieure du code serait détectée.
 *
 * Il est ignoré si le texte officiel n'est pas présent : la suite reste
 * exécutable sur un poste qui ne l'a pas récupéré.
 */
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const TEXTE_OFFICIEL = join(
  RACINE,
  'sources-reglementaires',
  'CELEX_02006R1907-20260622_FR_TXT.pdf',
)

const disponible = await access(TEXTE_OFFICIEL).then(
  () => true,
  () => false,
)

const describeSiDisponible = disponible ? describe : describe.skip

describeSiDisponible('concordance avec le règlement', () => {
  it(
    'retrouve les seize rubriques du sommaire de l’annexe II',
    async () => {
      const octets = new Uint8Array(await readFile(TEXTE_OFFICIEL))
      const lecture = await extractTextFromPdf(octets)

      // Le sommaire du format figure dans la partie B de l'annexe II.
      const debut = lecture.text.indexOf('La fiche de données de sécurité doit comprendre les 16')
      expect(debut, "sommaire de l'annexe II introuvable").toBeGreaterThan(0)

      const sommaire = lecture.text.slice(debut, debut + 6000)
      const resultat = segmentSections(sommaire)

      expect([...resultat.sections.keys()].sort((a, b) => a - b)).toEqual(
        SDS_SECTIONS.map((section) => section.number),
      )
      expect(resultat.coverage).toBe(1)
    },
    120_000,
  )

  it(
    'confirme les intitulés déclarés dans le code',
    async () => {
      const octets = new Uint8Array(await readFile(TEXTE_OFFICIEL))
      const lecture = await extractTextFromPdf(octets)
      const debut = lecture.text.indexOf('La fiche de données de sécurité doit comprendre les 16')
      const sommaire = lecture.text.slice(debut, debut + 6000)
      const resultat = segmentSections(sommaire)

      for (const attendue of SDS_SECTIONS) {
        const lue = resultat.sections.get(attendue.number)
        expect(lue, `rubrique ${attendue.number}`).toBeDefined()

        // Le sommaire coupe les intitulés longs sur plusieurs lignes : on
        // compare ce qui tient sur la ligne d'en-tête.
        const officiel = attendue.title.toLowerCase()
        const relevé = lue!.heading.toLowerCase()
        if (relevé.length > 0) {
          expect(officiel.startsWith(relevé.slice(0, officiel.length)), 
            `rubrique ${attendue.number} : « ${lue!.heading} » ne correspond pas à « ${attendue.title} »`,
          ).toBe(true)
        }
      }
    },
    120_000,
  )
})
