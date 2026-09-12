#!/usr/bin/env node
/**
 * Applique les migrations SQL de db/migrations dans l'ordre lexicographique.
 *
 * Chaque migration est jouée dans une transaction et enregistrée dans
 * app.schema_migrations avec son empreinte. Une migration déjà appliquée dont le
 * contenu a changé fait échouer la commande : on corrige par une nouvelle
 * migration, jamais en modifiant une migration déjà jouée en production.
 *
 * Usage : DATABASE_URL=postgres://... node scripts/migrate.mjs [--dry-run]
 */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')
const dryRun = process.argv.includes('--dry-run')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL est requis.')
  process.exit(1)
}

const checksum = (content) => createHash('sha256').update(content).digest('hex')

async function main() {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    const applied = await readAppliedMigrations(client)

    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      const digest = checksum(sql)
      const previous = applied.get(version)

      if (previous) {
        if (previous !== digest) {
          throw new Error(
            `La migration ${version} a déjà été appliquée avec un contenu différent. ` +
              'Créez une nouvelle migration au lieu de modifier celle-ci.',
          )
        }
        console.log(`· ${version} — déjà appliquée`)
        continue
      }

      if (dryRun) {
        console.log(`· ${version} — à appliquer (simulation)`)
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO app.schema_migrations (version, checksum) VALUES ($1, $2)',
          [version, digest],
        )
        await client.query('COMMIT')
        console.log(`✓ ${version} — appliquée`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Échec de la migration ${version} : ${error.message}`, { cause: error })
      }
    }
  } finally {
    await client.end()
  }
}

async function readAppliedMigrations(client) {
  const { rows } = await client.query(`
    SELECT to_regclass('app.schema_migrations') IS NOT NULL AS exists
  `)
  if (!rows[0]?.exists) return new Map()
  const result = await client.query('SELECT version, checksum FROM app.schema_migrations')
  return new Map(result.rows.map((row) => [row.version, row.checksum]))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
