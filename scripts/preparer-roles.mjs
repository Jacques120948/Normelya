#!/usr/bin/env node
/**
 * Crée les rôles PostgreSQL de Normelya et pose leurs privilèges.
 *
 * Rejouable : applicable à une base neuve comme à une base déjà configurée.
 * Le fichier db/roles.sql reste la référence unique de ce que chaque rôle a le
 * droit de faire ; ce script l'exécute et y ajoute les mots de passe, qui ne
 * doivent jamais être écrits dans un fichier versionné.
 *
 * Il se termine par une vérification qui ne se contente pas de constater
 * l'absence d'erreur : elle relit les attributs réellement posés. Un
 * normelya_app qui aurait gagné BYPASSRLS rendrait muettes toutes les
 * politiques d'isolation sans qu'aucun test fonctionnel ne le signale.
 *
 * Usage :
 *   ADMIN_DATABASE_URL=postgres://...        \
 *   NORMELYA_APP_PASSWORD=...                \
 *   NORMELYA_SERVICE_PASSWORD=...            \
 *   node scripts/preparer-roles.mjs
 */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

const adminUrl = process.env.ADMIN_DATABASE_URL
const motDePasseApp = process.env.NORMELYA_APP_PASSWORD
const motDePasseService = process.env.NORMELYA_SERVICE_PASSWORD

if (!adminUrl || !motDePasseApp || !motDePasseService) {
  console.error(
    'ADMIN_DATABASE_URL, NORMELYA_APP_PASSWORD et NORMELYA_SERVICE_PASSWORD sont requis.',
  )
  process.exit(1)
}

/** Littéral de chaîne SQL. Les mots de passe ne passent pas en paramètre lié. */
function litteral(valeur) {
  return `'${String(valeur).replace(/'/g, "''")}'`
}

async function main() {
  const client = new pg.Client({ connectionString: adminUrl })
  await client.connect()

  try {
    const sql = await readFile(join(RACINE, 'db', 'roles.sql'), 'utf8')
    await client.query(sql)
    console.log('✓ rôles et privilèges appliqués')

    await client.query(`ALTER ROLE normelya_app PASSWORD ${litteral(motDePasseApp)}`)
    await client.query(`ALTER ROLE normelya_service PASSWORD ${litteral(motDePasseService)}`)
    console.log('✓ mots de passe posés')

    await verifier(client)
  } finally {
    await client.end()
  }
}

/**
 * Relit les attributs effectivement posés.
 *
 * Certains hébergements refusent d'accorder BYPASSRLS à un rôle non
 * superutilisateur. Le refus doit être dit explicitement : sans ce privilège,
 * la création de compte échoue, car elle écrit un utilisateur qui n'appartient
 * encore à aucune organisation.
 */
async function verifier(client) {
  const { rows } = await client.query(
    `SELECT rolname, rolbypassrls, rolcanlogin
     FROM pg_roles WHERE rolname IN ('normelya_app', 'normelya_service')
     ORDER BY rolname`,
  )

  const parNom = new Map(rows.map((ligne) => [ligne.rolname, ligne]))
  const app = parNom.get('normelya_app')
  const service = parNom.get('normelya_service')
  const problemes = []

  if (!app) problemes.push('normelya_app est absent.')
  else {
    if (app.rolbypassrls) {
      problemes.push(
        'normelya_app possède BYPASSRLS. Les politiques d’isolation seraient ' +
          'contournées pour toutes les requêtes utilisateur.',
      )
    }
    if (!app.rolcanlogin) problemes.push('normelya_app ne peut pas se connecter.')
  }

  if (!service) problemes.push('normelya_service est absent.')
  else {
    if (!service.rolbypassrls) {
      problemes.push(
        'normelya_service ne possède pas BYPASSRLS. L’hébergeur a probablement ' +
          'refusé de l’accorder à un rôle non superutilisateur. Utilisez le rôle ' +
          'administrateur du projet pour SERVICE_DATABASE_URL, et conservez ' +
          'normelya_app pour DATABASE_URL : c’est ce dernier qui porte l’isolation.',
      )
    }
    if (!service.rolcanlogin) problemes.push('normelya_service ne peut pas se connecter.')
  }

  for (const ligne of rows) {
    console.log(
      `· ${ligne.rolname} — BYPASSRLS ${ligne.rolbypassrls ? 'oui' : 'non'}, ` +
        `connexion ${ligne.rolcanlogin ? 'oui' : 'non'}`,
    )
  }

  if (problemes.length > 0) {
    console.error('\nVérification des rôles en échec :')
    for (const probleme of problemes) console.error(`  - ${probleme}`)
    process.exit(1)
  }

  console.log('✓ attributs vérifiés')
}

main().catch((erreur) => {
  console.error(erreur.message)
  process.exit(1)
})
