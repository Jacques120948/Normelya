#!/usr/bin/env tsx
/**
 * Purge des données dont la durée de conservation est écoulée.
 *
 * Aujourd'hui : les attestations de validation pseudonymisées, dix ans après la
 * suppression du compte. Voir docs/18-conservation-des-attestations.md.
 *
 * Cette purge est AUTOMATIQUE : elle est exécutée quotidiennement par une tâche
 * planifiée, jamais à la main. Une conservation qui dépend d'un geste humain
 * n'est pas une politique de conservation.
 *
 * Usage :
 *   SERVICE_DATABASE_URL=postgres://... npm run purger
 *   SERVICE_DATABASE_URL=postgres://... npm run purger -- --simulation
 *
 * La date d'évaluation peut être forcée pour vérifier le comportement :
 *   npm run purger -- --date=2036-01-01 --simulation
 */
import pg from 'pg'

type Options = {
  simulation: boolean
  evaluatedOn: string
}

function lireOptions(arguments_: readonly string[]): Options {
  const dateFournie = arguments_.find((a) => a.startsWith('--date='))?.slice('--date='.length)
  const evaluatedOn = dateFournie ?? new Date().toISOString().slice(0, 10)

  if (!/^\d{4}-\d{2}-\d{2}$/.test(evaluatedOn)) {
    throw new Error(`Date d'évaluation invalide : ${evaluatedOn}`)
  }

  return {
    simulation: arguments_.includes('--simulation'),
    evaluatedOn,
  }
}

async function main(): Promise<void> {
  const options = lireOptions(process.argv.slice(2))

  const url = process.env.SERVICE_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error('SERVICE_DATABASE_URL est requis : la purge s’exécute avec le rôle de service.')
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: url })
  await client.connect()

  try {
    const { rows } = await client.query<{ total: string }>(
      `SELECT count(*)::text AS total
       FROM validation_attestations
       WHERE purge_due_on IS NOT NULL AND purge_due_on <= $1`,
      [options.evaluatedOn],
    )
    const echues = Number(rows[0]?.total ?? 0)

    console.log(`Date d'évaluation : ${options.evaluatedOn}`)
    console.log(`Attestations dont la conservation est échue : ${echues}`)

    if (echues === 0) {
      console.log('Rien à purger.')
      return
    }

    if (options.simulation) {
      console.log('Simulation : aucune suppression effectuée.')
      return
    }

    const resultat = await client.query<{ purge_expired_attestations: number }>(
      `SELECT app.purge_expired_attestations($1)`,
      [options.evaluatedOn],
    )
    const supprimees = resultat.rows[0]?.purge_expired_attestations ?? 0
    console.log(`Attestations purgées : ${supprimees}`)
  } finally {
    await client.end()
  }
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
})
