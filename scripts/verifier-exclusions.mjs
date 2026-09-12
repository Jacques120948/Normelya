#!/usr/bin/env node
/**
 * Contrôle automatisé des exclusions du dépôt.
 *
 * Deux catégories de fichiers ne doivent JAMAIS être versionnées :
 *
 *   · les fiches de données de sécurité fournisseur, qui appartiennent à leurs
 *     auteurs et peuvent porter des données commercialement sensibles ;
 *   · toute donnée client : documents déposés, recettes, exports, rapports
 *     nommant des fichiers.
 *
 * Ce script vérifie que la configuration d'exclusion couvre effectivement ces
 * chemins, en interrogeant git lui-même plutôt qu'en relisant le fichier de
 * règles. Une règle mal écrite passerait une relecture, pas ce contrôle.
 *
 * Il signale également tout fichier de ces catégories déjà suivi par git.
 */
import { execFileSync } from 'node:child_process'

/** Chemins qui doivent être exclus. Ils n'ont pas besoin d'exister. */
const DOIVENT_ETRE_EXCLUS = [
  'fixtures-fds/nouvelle-fiche.pdf',
  'fixtures-fds/sous-dossier/fiche.pdf',
  'fixtures-fds/rapport-lecture.json',
  'un-parfum.fds.pdf',
  '.tmp/documents/org-1/document.pdf',
  'apps/web/.tmp/documents/org-1/document.pdf',
  '.env',
  '.env.local',
  'apps/web/.env.local',
]

/** Chemins qui doivent rester versionnés. */
const DOIVENT_ETRE_SUIVIS = ['fixtures-fds/README.md', '.env.example']

function estExclu(chemin) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', chemin], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const problemes = []

for (const chemin of DOIVENT_ETRE_EXCLUS) {
  if (!estExclu(chemin)) problemes.push(`${chemin} n'est PAS exclu du dépôt.`)
}

for (const chemin of DOIVENT_ETRE_SUIVIS) {
  if (estExclu(chemin)) problemes.push(`${chemin} est exclu alors qu'il doit rester versionné.`)
}

// Fichiers sensibles déjà suivis par git, que l'exclusion ne rattrape pas.
const suivis = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n')
const fdsSuivies = suivis.filter(
  (chemin) => chemin.startsWith('fixtures-fds/') && chemin !== 'fixtures-fds/README.md',
)
const secretsSuivis = suivis.filter((chemin) => /(^|\/)\.env($|\.local$)/.test(chemin))

if (secretsSuivis.length > 0) {
  problemes.push(`Fichiers de configuration secrets suivis : ${secretsSuivis.join(', ')}`)
}

if (problemes.length > 0) {
  console.error("Contrôle des exclusions : échec.\n")
  for (const probleme of problemes) console.error(`  · ${probleme}`)
  process.exit(1)
}

console.log('Contrôle des exclusions : la règle couvre les fiches et les données client.')

if (fdsSuivies.length > 0) {
  // Décision du 12 septembre 2026 : l'historique existant est conservé, le
  // dépôt étant privé. La règle reste active pour toute fiche ultérieure.
  console.warn(
    `\nRappel : ${fdsSuivies.length} fiche(s) versionnée(s) avant la mise en place de la règle.\n` +
      "Elles restent dans l'historique par décision explicite. Toute fiche ajoutée\n" +
      'désormais est exclue automatiquement.',
  )
}
