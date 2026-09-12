#!/usr/bin/env node
/**
 * Contrôle automatisé : aucun secret ne doit fuir vers le navigateur.
 *
 * Deux vérifications :
 *   1. aucune variable sensible n'est déclarée avec le préfixe NEXT_PUBLIC_ ;
 *   2. aucun fichier marqué 'use client' ne lit une variable serveur.
 *
 * Ce script est exécuté en intégration continue et échoue le build.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const RACINE = process.cwd()

/** Fragments de noms qui ne doivent jamais apparaître après NEXT_PUBLIC_. */
const MOTS_SENSIBLES = ['SERVICE_ROLE', 'SECRET', 'PRIVATE', 'PASSWORD', 'DATABASE_URL', 'API_KEY']

/** Variables serveur interdites dans un composant client. */
const VARIABLES_SERVEUR = [
  'DATABASE_URL',
  'SERVICE_DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'HASH_SALT',
]

const IGNORES = new Set(['node_modules', '.next', 'dist', 'coverage', '.git'])

async function fichiers(repertoire) {
  const trouves = []
  for (const entree of await readdir(repertoire, { withFileTypes: true })) {
    if (IGNORES.has(entree.name)) continue
    const chemin = join(repertoire, entree.name)
    if (entree.isDirectory()) {
      trouves.push(...(await fichiers(chemin)))
    } else if (/\.(ts|tsx|mjs|js)$/.test(entree.name)) {
      trouves.push(chemin)
    }
  }
  return trouves
}

const problemes = []

for (const chemin of await fichiers(RACINE)) {
  const contenu = await readFile(chemin, 'utf8')
  const relatif = chemin.slice(RACINE.length + 1)

  // 1. Préfixe public accolé à un nom sensible.
  for (const mot of MOTS_SENSIBLES) {
    const motif = new RegExp(`NEXT_PUBLIC_[A-Z0-9_]*${mot}`)
    if (motif.test(contenu)) {
      problemes.push(`${relatif} : une variable publique porte un nom sensible (${mot}).`)
    }
  }

  // 2. Variable serveur lue depuis un composant client.
  const estClient = /^\s*['"]use client['"]/m.test(contenu)
  if (estClient) {
    for (const variable of VARIABLES_SERVEUR) {
      if (contenu.includes(variable)) {
        problemes.push(`${relatif} : composant client lisant la variable serveur ${variable}.`)
      }
    }
  }
}

if (problemes.length > 0) {
  console.error('Contrôle des secrets : échec.\n')
  for (const probleme of problemes) console.error(`  · ${probleme}`)
  process.exit(1)
}

console.log('Contrôle des secrets : aucun problème détecté.')
