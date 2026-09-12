#!/usr/bin/env node
/**
 * Contrôle automatisé du vocabulaire.
 *
 * Normelya n'affirme jamais qu'un produit est en règle. Les termes « conforme »,
 * « conformité garantie », « certifié » et « homologué » sont interdits partout
 * où un utilisateur peut les lire : interface, documents générés, pages
 * publiques.
 *
 * Le substantif « conformité » reste autorisé : il nomme un domaine
 * (« centre de conformité »), il n'affirme rien sur un produit.
 *
 * Une ligne peut être exemptée en la faisant précéder du commentaire
 * `vocabulaire-autorise:` suivi de la raison, et un bloc entier peut l'être
 * entre `vocabulaire-autorise-debut:` et `vocabulaire-autorise-fin`. C'est
 * réservé aux cas où le terme est cité pour être interdit, jamais pour
 * l'employer.
 *
 * Exécuté en intégration continue, ce script échoue le build.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const RACINE = process.cwd()

/** Zones où un texte est lu par un utilisateur final. */
const ZONES = [
  'apps/web/src/app',
  'apps/web/src/components',
  'apps/web/src/i18n',
  'packages/core/src',
]

const LETTRE = '[\\p{L}\\p{M}]'
const MOTIFS = [
  { nom: 'conforme', regex: new RegExp(`(?<!${LETTRE})conformes?(?!${LETTRE})`, 'iu') },
  { nom: 'conformité garantie', regex: /conformité\s+garantie/iu },
  { nom: 'certifié', regex: new RegExp(`(?<!${LETTRE})certifiée?s?(?!${LETTRE})`, 'iu') },
  { nom: 'homologué', regex: new RegExp(`(?<!${LETTRE})homologuée?s?(?!${LETTRE})`, 'iu') },
]

const EXEMPTION = /vocabulaire-autorise\s*:/i
const EXEMPTION_DEBUT = /vocabulaire-autorise-debut\s*:/i
const EXEMPTION_FIN = /vocabulaire-autorise-fin/i
const IGNORES = new Set(['node_modules', '.next', 'dist', 'coverage'])
const EXTENSIONS = /\.(ts|tsx|md|html)$/

async function fichiers(repertoire) {
  let trouves = []
  let entrees
  try {
    entrees = await readdir(repertoire, { withFileTypes: true })
  } catch {
    return trouves
  }
  for (const entree of entrees) {
    if (IGNORES.has(entree.name)) continue
    const chemin = join(repertoire, entree.name)
    if (entree.isDirectory()) {
      trouves = trouves.concat(await fichiers(chemin))
    } else if (EXTENSIONS.test(entree.name)) {
      trouves.push(chemin)
    }
  }
  return trouves
}

const problemes = []

for (const zone of ZONES) {
  for (const chemin of await fichiers(join(RACINE, zone))) {
    const lignes = (await readFile(chemin, 'utf8')).split('\n')
    const relatif = chemin.slice(RACINE.length + 1)

    let dansUnBlocExempte = false

    lignes.forEach((ligne, index) => {
      if (EXEMPTION_DEBUT.test(ligne)) {
        dansUnBlocExempte = true
        return
      }
      if (EXEMPTION_FIN.test(ligne)) {
        dansUnBlocExempte = false
        return
      }
      if (dansUnBlocExempte) return
      if (EXEMPTION.test(ligne)) return
      const precedente = lignes[index - 1] ?? ''
      if (EXEMPTION.test(precedente)) return

      for (const motif of MOTIFS) {
        if (motif.regex.test(ligne)) {
          problemes.push(`${relatif}:${index + 1} — « ${motif.nom} » : ${ligne.trim()}`)
        }
      }
    })
  }
}

if (problemes.length > 0) {
  console.error('Contrôle du vocabulaire : échec.\n')
  for (const probleme of problemes) console.error(`  · ${probleme}`)
  console.error(
    '\nFormulations autorisées : « analyse terminée », ' +
      '« calcul effectué selon le règlement (CE) n° 1272/2008 », « à vérifier ».',
  )
  process.exit(1)
}

console.log('Contrôle du vocabulaire : aucun terme interdit détecté.')
