import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { RequestContext } from '@normelya/core'
import { LocalFileStorage } from '../../apps/web/src/server/adapters/local-storage'
import { importSdsDocument } from '../../apps/web/src/server/application/sds-import'
import {
  notifyAffectedProducts,
  validateSdsVersion,
} from '../../apps/web/src/server/application/sds-validation'
import type { Database } from '../../apps/web/src/server/ports/database'
import { createDatabasePorts, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Parcours complet d'une fiche de données de sécurité : import, lecture,
 * vérification, validation, nouvelle version, archivage, alerte.
 *
 * Exécuté sur une vraie base, avec le rôle applicatif soumis aux politiques.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

/** PDF minimal et valide, porteur des lignes fournies. */
function construirePdf(lignes: readonly string[]): Uint8Array {
  const echapper = (t: string) => t.replace(/([()\\])/g, '\\$1')
  const contenu =
    'BT /F1 10 Tf\n' +
    lignes.map((l, i) => `1 0 0 1 40 ${800 - i * 16} Tm (${echapper(l)}) Tj`).join('\n') +
    '\nET'
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let doc = '%PDF-1.4\n'
  const offsets: number[] = []
  objets.forEach((corps, i) => {
    offsets.push(doc.length)
    doc += `${i + 1} 0 obj\n${corps}\nendobj\n`
  })
  const debutXref = doc.length
  doc += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) doc += `${o.toString().padStart(10, '0')} 00000 n \n`
  doc += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(doc, 'latin1'))
}

const FICHE_V1 = construirePdf([
  'RUBRIQUE 1 : Identification',
  'Nom commercial : DEMO Parfum Fleur',
  'Fournisseur : DEMO Maison des Parfums',
  'RUBRIQUE 2 : Identification des dangers',
  'Classification : Skin Sens. 1, H317',
  'RUBRIQUE 3 : Composition',
  'DEMO Substance A 78-70-6 5 - 10 % Skin Sens. 1 H317',
  'RUBRIQUE 9 : Proprietes',
  "Point d'eclair : 93 C",
  'RUBRIQUE 16 : Autres informations',
  'Version : 1.0',
  'Date de version: 05/11/2025',
])

const FICHE_V2 = construirePdf([
  'RUBRIQUE 1 : Identification',
  'Nom commercial : DEMO Parfum Fleur',
  'RUBRIQUE 3 : Composition',
  'DEMO Substance A 78-70-6 8 - 12 % Skin Sens. 1 H317',
  'RUBRIQUE 16 : Autres informations',
  'Version : 2.0',
  'Date de version: 01/03/2026',
])

describeDb('import et validation d’une fiche', () => {
  let dropDatabase: () => Promise<void>
  let databaseName: string
  let racineStockage: string
  let deps: { db: Database; serviceDb: Database; storage: LocalFileStorage }
  let fermerPorts: () => Promise<void>
  let contexte: RequestContext

  const atelier = { org: '', user: '', matiere: '', produit: '' }
  let versionV1 = ''

  beforeAll(async () => {
    const created = await createTestDatabase()
    await created.pool.end()
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName
    racineStockage = await mkdtemp(join(tmpdir(), 'normelya-fds-'))

    await seedAsOwner(databaseName, async (client) => {
      const { rows: u } = await client.query<{ id: string }>(
        `INSERT INTO users (auth_provider, auth_subject, email, first_name, last_name)
         VALUES ('test', 'importeur', 'importeur@exemple.fr', 'Camille', 'Durand') RETURNING id`,
      )
      const { rows: o } = await client.query<{ id: string }>(
        `INSERT INTO organizations (name, country) VALUES ('DEMO Atelier', 'FR') RETURNING id`,
      )
      atelier.user = u[0]!.id
      atelier.org = o[0]!.id
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [atelier.org, atelier.user],
      )
      const { rows: m } = await client.query<{ id: string }>(
        `INSERT INTO raw_materials (organization_id, name, category)
         VALUES ($1, 'DEMO Parfum Fleur', 'fragrance') RETURNING id`,
        [atelier.org],
      )
      atelier.matiere = m[0]!.id
    })

    const ports = await createDatabasePorts(databaseName)
    fermerPorts = ports.close
    deps = {
      db: ports.db,
      serviceDb: ports.serviceDb,
      storage: new LocalFileStorage({ directory: racineStockage, signingSecret: 'test' }),
    }

    contexte = {
      userId: atelier.user,
      organizationId: atelier.org,
      role: 'owner',
      plan: 'pro',
      locale: 'fr',
      isPlatformAdmin: false,
    }
  }, 90_000)

  afterAll(async () => {
    if (fermerPorts) await fermerPorts()
    if (racineStockage) await rm(racineStockage, { recursive: true, force: true })
    if (dropDatabase) await dropDatabase()
  })

  it('refuse un fichier qui n’est pas un PDF', async () => {
    const resultat = await importSdsDocument(deps, contexte, {
      rawMaterialId: atelier.matiere,
      filename: 'faux.pdf',
      bytes: new Uint8Array(Buffer.from('<html>pas un pdf</html>', 'utf8')),
    })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.code).toBe('UNSUPPORTED_FILE')
  })

  it('importe une fiche, la lit, et la laisse en attente de vérification', async () => {
    const resultat = await importSdsDocument(deps, contexte, {
      rawMaterialId: atelier.matiere,
      filename: 'demo-v1.pdf',
      bytes: FICHE_V1,
    })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) throw new Error(resultat.error.userMessage)

    versionV1 = resultat.value.sdsVersionId
    expect(resultat.value.alreadyImported).toBe(false)
    expect(resultat.value.method).toBe('pdf_text')
    expect(resultat.value.extraction?.composition.rows).toHaveLength(1)

    const version = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT status::text, validated_payload, extracted_payload IS NOT NULL AS lue
         FROM sds_versions WHERE id = $1`,
        [versionV1],
      )
      return rows[0]!
    })

    // Rien n'est réputé exact tant qu'une personne n'a pas confirmé.
    expect(version.status).toBe('needs_review')
    expect(version.validated_payload).toBeNull()
    expect(version.lue).toBe(true)
  })

  it('journalise la méthode de lecture employée', async () => {
    const tentative = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT method::text, succeeded FROM sds_extraction_runs WHERE sds_version_id = $1`,
        [versionV1],
      )
      return rows[0]!
    })
    expect(tentative.method).toBe('pdf_text')
    expect(tentative.succeeded).toBe(true)
  })

  it('ne redépose ni ne relit un document déjà importé', async () => {
    const resultat = await importSdsDocument(deps, contexte, {
      rawMaterialId: atelier.matiere,
      filename: 'demo-v1-copie.pdf',
      bytes: FICHE_V1,
    })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value.alreadyImported).toBe(true)
    expect(resultat.value.sdsVersionId).toBe(versionV1)
  })

  it('refuse de valider sans confirmation explicite', async () => {
    const resultat = await validateSdsVersion(
      deps,
      contexte,
      { fullName: 'Camille Durand', email: 'importeur@exemple.fr' },
      {
        sdsVersionId: versionV1,
        payload: {
          commercialName: 'DEMO Parfum Fleur',
          versionLabel: '1.0',
          flashPointCelsius: 93,
          hazardStatements: ['H317'],
          euhStatements: [],
          precautionaryStatements: [],
          substances: [],
        },
        confirmed: false,
      },
    )
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.code).toBe('VALIDATION_FAILED')
  })

  it('enregistre l’attestation avant les données, et scelle ce qui a été validé', async () => {
    const payload = {
      commercialName: 'DEMO Parfum Fleur',
      supplierName: 'DEMO Maison des Parfums',
      versionLabel: '1.0',
      revisionDate: '2025-11-05',
      language: 'fr',
      flashPointCelsius: 93,
      hazardStatements: ['H317'],
      euhStatements: [],
      precautionaryStatements: [],
      substances: [
        {
          declaredName: 'DEMO Substance A',
          casNumber: '78-70-6',
          ecNumber: '',
          concentrationMin: 5,
          concentrationMax: 10,
          concentrationExact: null,
          classificationText: 'Skin Sens. 1',
          hazardStatements: ['H317'],
        },
      ],
    }

    const resultat = await validateSdsVersion(
      deps,
      contexte,
      { fullName: 'Camille Durand', email: 'importeur@exemple.fr' },
      { sdsVersionId: versionV1, payload, confirmed: true },
    )
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) throw new Error(resultat.error.userMessage)
    expect(resultat.value.dataHash).toMatch(/^[0-9a-f]{64}$/)

    const attestation = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT user_id, data_hash, statement_text, attested_by_name, attested_by_email
         FROM validation_attestations WHERE id = $1`,
        [resultat.value.attestationId],
      )
      return rows[0]!
    })
    expect(attestation.user_id).toBe(atelier.user)
    expect(attestation.data_hash).toBe(resultat.value.dataHash)
    expect(attestation.statement_text).toBe('Je confirme avoir vérifié ces informations.')
    expect(attestation.attested_by_name).toBe('Camille Durand')

    const version = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT status::text, validated_by, validated_at, validated_payload
         FROM sds_versions WHERE id = $1`,
        [versionV1],
      )
      return rows[0]!
    })
    expect(version.status).toBe('validated')
    expect(version.validated_by).toBe(atelier.user)
    expect(version.validated_at).toBeInstanceOf(Date)
    expect(version.validated_payload.substances).toHaveLength(1)
  })

  it('écrit la composition validée, marquée comme corrigée', async () => {
    const substances = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT declared_name, cas_number, concentration_min::text, concentration_max::text,
                source::text
         FROM sds_substances WHERE sds_version_id = $1 ORDER BY position`,
        [versionV1],
      )
      return rows
    })
    expect(substances).toHaveLength(1)
    expect(substances[0]!.declared_name).toBe('DEMO Substance A')
    expect(substances[0]!.cas_number).toBe('78-70-6')
    // La plage est conservée : aucune valeur médiane n'est calculée.
    expect(Number(substances[0]!.concentration_min)).toBe(5)
    expect(Number(substances[0]!.concentration_max)).toBe(10)
    expect(substances[0]!.source).toBe('corrected')
  })

  it('refuse de valider deux fois la même version', async () => {
    const resultat = await validateSdsVersion(
      deps,
      contexte,
      { fullName: 'Camille Durand', email: 'importeur@exemple.fr' },
      {
        sdsVersionId: versionV1,
        payload: {
          commercialName: 'DEMO Parfum Fleur',
          versionLabel: '1.0',
          flashPointCelsius: null,
          hazardStatements: [],
          euhStatements: [],
          precautionaryStatements: [],
          substances: [],
        },
        confirmed: true,
      },
    )
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.code).toBe('CONFLICT')
  })

  it('archive la version précédente et signale les produits concernés', async () => {
    // Un produit s'appuie sur la version validée.
    await seedAsOwner(databaseName, async (client) => {
      const { rows: p } = await client.query<{ id: string }>(
        `INSERT INTO products (organization_id, name, product_type, status)
         VALUES ($1, 'DEMO Bougie', 'candle', 'active') RETURNING id`,
        [atelier.org],
      )
      atelier.produit = p[0]!.id
      const { rows: pv } = await client.query<{ id: string }>(
        `INSERT INTO product_versions (organization_id, product_id, version_number, name_snapshot, markets)
         VALUES ($1, $2, 1, 'DEMO Bougie', '{FR}') RETURNING id`,
        [atelier.org, atelier.produit],
      )
      const { rows: r } = await client.query<{ id: string }>(
        `INSERT INTO recipes (organization_id, product_version_id, total_percent)
         VALUES ($1, $2, 100) RETURNING id`,
        [atelier.org, pv[0]!.id],
      )
      await client.query(
        `INSERT INTO recipe_ingredients
           (organization_id, recipe_id, raw_material_id, sds_version_id, percent, role)
         VALUES ($1, $2, $3, $4, 100, 'fragrance')`,
        [atelier.org, r[0]!.id, atelier.matiere, versionV1],
      )
    })

    const importation = await importSdsDocument(deps, contexte, {
      rawMaterialId: atelier.matiere,
      filename: 'demo-v2.pdf',
      bytes: FICHE_V2,
    })
    expect(importation.ok).toBe(true)
    if (!importation.ok) throw new Error(importation.error.userMessage)

    const validation = await validateSdsVersion(
      deps,
      contexte,
      { fullName: 'Camille Durand', email: 'importeur@exemple.fr' },
      {
        sdsVersionId: importation.value.sdsVersionId,
        payload: {
          commercialName: 'DEMO Parfum Fleur',
          versionLabel: '2.0',
          revisionDate: '2026-03-01',
          flashPointCelsius: null,
          hazardStatements: ['H317'],
          euhStatements: [],
          precautionaryStatements: [],
          substances: [],
        },
        confirmed: true,
      },
    )
    expect(validation.ok).toBe(true)
    if (!validation.ok) throw new Error(validation.error.userMessage)

    expect(validation.value.archivedVersionId).toBe(versionV1)
    expect(validation.value.affectedProductIds).toEqual([atelier.produit])

    // L'ancienne version est archivée, jamais supprimée.
    const ancienne = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT status::text, archived_at, validated_payload IS NOT NULL AS conservee
         FROM sds_versions WHERE id = $1`,
        [versionV1],
      )
      return rows[0]!
    })
    expect(ancienne.status).toBe('archived')
    expect(ancienne.archived_at).toBeInstanceOf(Date)
    expect(ancienne.conservee).toBe(true)

    // L'analyse du produit n'est pas recalculée : une alerte est levée.
    await notifyAffectedProducts(deps, contexte, {
      productIds: validation.value.affectedProductIds,
      commercialName: 'DEMO Parfum Fleur',
    })

    const alerte = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT type::text, severity::text, product_id FROM notifications
         WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [atelier.org],
      )
      return rows[0]!
    })
    expect(alerte.type).toBe('product_uses_old_sds')
    expect(alerte.severity).toBe('action')
    expect(alerte.product_id).toBe(atelier.produit)
  })

  it('conserve le lien de la recette vers la version exacte utilisée', async () => {
    // Une nouvelle version fournisseur ne réécrit jamais l'historique.
    const lien = await seedAsOwner(databaseName, async (client) => {
      const { rows } = await client.query(
        `SELECT sds_version_id FROM recipe_ingredients WHERE raw_material_id = $1`,
        [atelier.matiere],
      )
      return rows[0]!
    })
    expect(lien.sds_version_id).toBe(versionV1)
  })
})
