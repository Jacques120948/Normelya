#!/usr/bin/env tsx
/**
 * Mesure du taux de réussite de la lecture automatique sur le corpus de fiches.
 *
 * Objectif de la phase 3 : savoir quels formats de fiches passent en lecture
 * automatique et lesquels basculent en saisie manuelle.
 *
 * Le corpus n'est jamais versionné : les fiches appartiennent aux fournisseurs.
 * Voir docs/16-corpus-fds.md.
 *
 * Usage :
 *   npm run mesurer:corpus -- [dossier]
 *
 * Par défaut, le dossier est fixtures-fds/ à la racine du dépôt.
 *
 * Aucun appel à un modèle de langage n'est effectué par ce script : il mesure
 * exclusivement la lecture déterministe.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import { extractTextFromPdf, looksLikePdf } from '../packages/sds-extraction/src/pdf/index'
import { extractFromText } from '../packages/sds-extraction/src/text/pipeline'
import {
  buildCorpusReport,
  formatCorpusReport,
  measureSheet,
  type SheetMeasurement,
} from '../packages/sds-extraction/src/report/coverage'

const RACINE = process.cwd()
const dossier = process.argv[2] ?? join(RACINE, 'fixtures-fds')

async function listerPdf(repertoire: string): Promise<string[]> {
  let entrees
  try {
    entrees = await readdir(repertoire, { withFileTypes: true })
  } catch {
    return []
  }

  const fichiers: string[] = []
  for (const entree of entrees) {
    const chemin = join(repertoire, entree.name)
    if (entree.isDirectory()) {
      fichiers.push(...(await listerPdf(chemin)))
    } else if (extname(entree.name).toLowerCase() === '.pdf') {
      fichiers.push(chemin)
    }
  }
  return fichiers.sort()
}

async function main(): Promise<void> {
  const fichiers = await listerPdf(dossier)

  if (fichiers.length === 0) {
    console.error(`Aucune fiche trouvée dans ${relative(RACINE, dossier) || dossier}.`)
    console.error('')
    console.error('Le corpus est attendu à cet emplacement mais n’est pas versionné.')
    console.error('Voir docs/16-corpus-fds.md pour sa constitution.')
    console.error('')
    console.error('Aucun taux de réussite ne peut être établi sans corpus.')
      process.exit(2)
  }

  console.log(`Lecture de ${fichiers.length} fiche(s) depuis ${relative(RACINE, dossier)}…\n`)

  const mesures: SheetMeasurement[] = []
  const echecs: Array<{ fichier: string; raison: string }> = []

  for (const fichier of fichiers) {
    const reference = relative(dossier, fichier)
    try {
      const octets = new Uint8Array(await readFile(fichier))

      if (!looksLikePdf(octets)) {
        echecs.push({ fichier: reference, raison: "le fichier n'est pas un PDF" })
        continue
      }

      const lecture = await extractTextFromPdf(octets)

      if (!lecture.hasTextLayer) {
        // Sans couche de texte, la lecture déterministe ne peut rien faire :
        // le document devra passer par la reconnaissance optique.
        mesures.push(
          measureSheet({
            documentRef: reference,
            outcome: extractFromText(''),
            method: 'ocr',
          }),
        )
        console.log(`  ⚠ ${reference} — aucune couche de texte, reconnaissance optique nécessaire`)
        continue
      }

      const resultat = extractFromText(lecture.text)
      const mesure = measureSheet({ documentRef: reference, outcome: resultat, method: 'pdf_text' })
      mesures.push(mesure)

      const symbole =
        mesure.verdict === 'automatic' ? '✓' : mesure.verdict === 'light_review' ? '·' : '✗'
      console.log(
        `  ${symbole} ${reference} — ${mesure.verdict}, ${mesure.compositionRowCount} composant(s), ${mesure.issueCount} point(s) d’attention`,
      )
    } catch (erreur) {
      echecs.push({
        fichier: reference,
        raison: erreur instanceof Error ? erreur.message : String(erreur),
      })
    }
  }

  const rapport = buildCorpusReport(mesures)

  console.log('')
  console.log('─'.repeat(70))
  console.log(formatCorpusReport(rapport))

  if (echecs.length > 0) {
    console.log('')
    console.log(`Fichiers non exploitables : ${echecs.length}`)
    for (const echec of echecs) {
      console.log(`  ✗ ${echec.fichier} — ${echec.raison}`)
    }
  }

  // Le rapport est écrit à côté du corpus, donc hors du dépôt : il nomme des
  // fichiers fournisseurs.
  const destination = join(dossier, 'rapport-lecture.json')
  await writeFile(
    destination,
    JSON.stringify({ generatedAt: new Date().toISOString(), rapport, mesures, echecs }, null, 2),
    'utf8',
  )
  console.log('')
  console.log(`Rapport détaillé écrit dans ${relative(RACINE, destination)} (non versionné).`)

}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
})
