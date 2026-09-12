import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { RequestContext } from '@normelya/core'
import {
  archiveProduct,
  createProduct,
  saveRecipe,
} from '../../apps/web/src/server/application/products'
import {
  listProducts,
  listRecipeIngredients,
  listProductVersions,
  listSelectableMaterials,
} from '../../apps/web/src/server/repositories/products'
import type { Database } from '../../apps/web/src/server/ports/database'
import { createDatabasePorts, createTestDatabase, hasTestDatabase, seedAsOwner } from './aide'

/**
 * Produits et recettes sur une vraie base, avec le rôle applicatif soumis aux
 * politiques d'isolation.
 *
 * Trois propriétés sont vérifiées ici parce qu'aucune ne peut l'être hors base :
 * le quota non renouvelable de l'offre gratuite, l'exigence d'un total de
 * recette exactement égal à 100 %, et la création d'une nouvelle version dès
 * qu'une analyse verrouille la version courante.
 */
const describeDb = hasTestDatabase ? describe : describe.skip

describeDb('produits et recettes', () => {
  let dropDatabase: () => Promise<void>
  let databaseName: string
  let fermer: () => Promise<void>
  let deps: { db: Database; serviceDb: Database }
  let contexte: RequestContext
  let contexteGratuit: RequestContext

  const atelier = {
    org: '',
    orgGratuite: '',
    user: '',
    userGratuit: '',
    cire: '',
    parfumA: '',
    parfumB: '',
    colorant: '',
    cireGratuite: '',
    versionFiche: '',
  }

  beforeAll(async () => {
    const created = await createTestDatabase()
    await created.pool.end()
    dropDatabase = created.dropDatabase
    databaseName = created.databaseName

    const ports = await createDatabasePorts(databaseName)
    deps = { db: ports.db, serviceDb: ports.serviceDb }
    fermer = ports.close

    await seedAsOwner(databaseName, async (client) => {
      const creerUtilisateur = async (sujet: string, email: string) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO users (auth_provider, auth_subject, email, first_name, last_name)
           VALUES ('test', $1, $2, 'Camille', 'Durand') RETURNING id`,
          [sujet, email],
        )
        return rows[0]!.id
      }
      const creerOrganisation = async (nom: string, userId: string) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO organizations (name, country) VALUES ($1, 'FR') RETURNING id`,
          [nom],
        )
        const orgId = rows[0]!.id
        await client.query(
          `INSERT INTO organization_members (organization_id, user_id, role)
           VALUES ($1, $2, 'owner')`,
          [orgId, userId],
        )
        return orgId
      }
      const creerMatiere = async (orgId: string, nom: string, categorie: string) => {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO raw_materials (organization_id, name, category)
           VALUES ($1, $2, $3) RETURNING id`,
          [orgId, nom, categorie],
        )
        return rows[0]!.id
      }

      atelier.user = await creerUtilisateur('formulateur', 'formulateur@exemple.fr')
      atelier.userGratuit = await creerUtilisateur('essai', 'essai@exemple.fr')
      atelier.org = await creerOrganisation('DEMO Atelier Pro', atelier.user)
      atelier.orgGratuite = await creerOrganisation('DEMO Atelier Essai', atelier.userGratuit)

      atelier.cire = await creerMatiere(atelier.org, 'DEMO Cire de soja', 'wax')
      atelier.parfumA = await creerMatiere(atelier.org, 'DEMO Parfum Fleur', 'fragrance')
      atelier.parfumB = await creerMatiere(atelier.org, 'DEMO Parfum Bois', 'fragrance')
      atelier.colorant = await creerMatiere(atelier.org, 'DEMO Colorant Ambre', 'dye')
      atelier.cireGratuite = await creerMatiere(atelier.orgGratuite, 'DEMO Cire', 'wax')

      // Une fiche validée sur le parfum A : la recette doit pouvoir s'y référer.
      const { rows: fiche } = await client.query<{ id: string }>(
        `INSERT INTO safety_data_sheets (organization_id, raw_material_id, commercial_name)
         VALUES ($1, $2, 'DEMO Parfum Fleur') RETURNING id`,
        [atelier.org, atelier.parfumA],
      )
      const { rows: document } = await client.query<{ id: string }>(
        `INSERT INTO documents
           (organization_id, kind, storage_key, original_filename, mime_type, byte_size, sha256,
            raw_material_id)
         VALUES ($1, 'sds', $2, 'demo.pdf', 'application/pdf', 1024, $3, $4)
         RETURNING id`,
        [atelier.org, `demo/${atelier.parfumA}.pdf`, 'a'.repeat(64), atelier.parfumA],
      )
      const { rows: version } = await client.query<{ id: string }>(
        `INSERT INTO sds_versions
           (organization_id, safety_data_sheet_id, document_id, version_label, status,
            validated_by, validated_at, validated_payload)
         VALUES ($1, $2, $3, '1.0', 'validated', $4, now(), '{}'::jsonb) RETURNING id`,
        [atelier.org, fiche[0]!.id, document[0]!.id, atelier.user],
      )
      atelier.versionFiche = version[0]!.id
    })

    contexte = {
      userId: atelier.user,
      organizationId: atelier.org,
      role: 'owner',
      plan: 'pro',
      locale: 'fr',
      isPlatformAdmin: false,
    }
    contexteGratuit = {
      userId: atelier.userGratuit,
      organizationId: atelier.orgGratuite,
      role: 'owner',
      plan: 'free',
      locale: 'fr',
      isPlatformAdmin: false,
    }
  }, 90_000)

  afterAll(async () => {
    if (fermer) await fermer()
    if (dropDatabase) await dropDatabase()
  })

  it('crée un produit, sa version 1 et le rend visible dans la liste', async () => {
    const resultat = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Ambre',
      productType: 'candle',
      markets: ['FR'],
      netWeightGrams: 180,
      containerDescription: 'Verre 200 ml',
    })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return

    const produits = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listProducts(client, atelier.org),
    )
    const produit = produits.find((p) => p.id === resultat.value.productId)
    expect(produit?.name).toBe('DEMO Bougie Ambre')
    expect(produit?.markets).toEqual(['FR'])
    expect(produit?.current_version_id).toBe(resultat.value.productVersionId)
    // Aucune recette encore : le décompte d'ingrédients doit valoir zéro, pas null.
    expect(produit?.ingredient_count).toBe(0)
    expect(produit?.recipe_total).toBeNull()
    expect(produit?.last_analysis_status).toBeNull()
  })

  it('refuse une recette dont le total n’est pas exactement 100 %', async () => {
    const cree = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Incomplète',
      productType: 'candle',
      markets: ['FR'],
    })
    expect(cree.ok).toBe(true)
    if (!cree.ok) return

    const resultat = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 90, role: 'wax' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 9.9, role: 'fragrance' },
      ],
    })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.code).toBe('VALIDATION_FAILED')
    // L'écart doit être affiché, pas seulement le refus.
    expect(resultat.error.message).toContain('100')
    expect(resultat.error.message).toContain('Il manque 0,1 %')

    // Rien n'a été écrit : l'échec de validation ne laisse pas de recette partielle.
    const ingredients = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listRecipeIngredients(client, atelier.org, cree.value.productVersionId),
    )
    expect(ingredients).toHaveLength(0)
  })

  it('enregistre une recette à plusieurs parfums et relit les pourcentages saisis', async () => {
    const cree = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Deux Parfums',
      productType: 'candle',
      markets: ['FR', 'CH'],
      netWeightGrams: 200,
    })
    expect(cree.ok).toBe(true)
    if (!cree.ok) return

    const resultat = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 88.5, role: 'wax' },
        {
          rawMaterialId: atelier.parfumA,
          sdsVersionId: atelier.versionFiche,
          percent: 7.2,
          role: 'fragrance',
        },
        { rawMaterialId: atelier.parfumB, sdsVersionId: null, percent: 3.8, role: 'fragrance' },
        { rawMaterialId: atelier.colorant, sdsVersionId: null, percent: 0.5, role: 'dye' },
      ],
    })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value.createdNewVersion).toBe(false)
    expect(resultat.value.totalPercent).toBe(100)

    const ingredients = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listRecipeIngredients(client, atelier.org, resultat.value.productVersionId),
    )
    expect(ingredients.map((i) => i.raw_material_name)).toEqual([
      'DEMO Cire de soja',
      'DEMO Parfum Fleur',
      'DEMO Parfum Bois',
      'DEMO Colorant Ambre',
    ])
    // Le pourcentage saisi est restitué tel quel : aucun arrondi silencieux.
    expect(ingredients.map((i) => Number(i.percent))).toEqual([88.5, 7.2, 3.8, 0.5])
    expect(ingredients[1]?.sds_version_label).toBe('1.0')
    expect(ingredients[1]?.sds_status).toBe('validated')
  })

  it('accepte 0,1 % de parfum et refuse au-delà de 30 %', async () => {
    const cree = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Bornes',
      productType: 'candle',
      markets: ['FR'],
    })
    expect(cree.ok).toBe(true)
    if (!cree.ok) return

    const basse = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 99.9, role: 'wax' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 0.1, role: 'fragrance' },
      ],
    })
    expect(basse.ok).toBe(true)

    const haute = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 69, role: 'wax' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 31, role: 'fragrance' },
      ],
    })
    expect(haute.ok).toBe(false)
    if (haute.ok) return
    expect(haute.error.code).toBe('VALIDATION_FAILED')

    // La recette précédente reste celle qui est enregistrée.
    const ingredients = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listRecipeIngredients(client, atelier.org, cree.value.productVersionId),
    )
    expect(ingredients.map((i) => Number(i.percent))).toEqual([99.9, 0.1])
  })

  it('refuse deux fois la même matière première dans une recette', async () => {
    const cree = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Doublon',
      productType: 'candle',
      markets: ['FR'],
    })
    expect(cree.ok).toBe(true)
    if (!cree.ok) return

    const resultat = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 90, role: 'wax' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 5, role: 'fragrance' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 5, role: 'fragrance' },
      ],
    })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.code).toBe('VALIDATION_FAILED')
    // Le message doit nommer la cause : un refus sans explication est inutile.
    expect(resultat.error.message).toContain('une seule fois')
  })

  it('crée une nouvelle version dès que la version courante est verrouillée', async () => {
    const cree = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Analysée',
      productType: 'candle',
      markets: ['FR'],
    })
    expect(cree.ok).toBe(true)
    if (!cree.ok) return

    const premiere = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 92, role: 'wax' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 8, role: 'fragrance' },
      ],
    })
    expect(premiere.ok).toBe(true)
    if (!premiere.ok) return

    // Une analyse se rattache à la version : elle est figée.
    await seedAsOwner(databaseName, (client) =>
      client.query(
        `UPDATE product_versions SET is_locked = true, locked_at = now() WHERE id = $1`,
        [premiere.value.productVersionId],
      ),
    )

    const seconde = await saveRecipe(deps, contexte, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cire, sdsVersionId: null, percent: 90, role: 'wax' },
        { rawMaterialId: atelier.parfumA, sdsVersionId: null, percent: 10, role: 'fragrance' },
      ],
    })
    expect(seconde.ok).toBe(true)
    if (!seconde.ok) return
    expect(seconde.value.createdNewVersion).toBe(true)
    expect(seconde.value.productVersionId).not.toBe(premiere.value.productVersionId)

    // La version figée conserve intégralement sa recette : elle reste rejouable.
    const ancienne = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listRecipeIngredients(client, atelier.org, premiere.value.productVersionId),
    )
    expect(ancienne.map((i) => Number(i.percent))).toEqual([92, 8])

    const versions = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listProductVersions(client, atelier.org, cree.value.productId),
    )
    expect(versions.map((v) => v.version_number)).toEqual([2, 1])
    // Les marchés de la version figée sont repris tels quels.
    expect(versions[0]?.markets).toEqual(['FR'])
    expect(versions[0]?.is_locked).toBe(false)
    expect(versions[1]?.is_locked).toBe(true)
  })

  it('épuise le quota non renouvelable de l’offre gratuite, même après archivage', async () => {
    const creer = (nom: string) =>
      createProduct(deps, contexteGratuit, {
        name: nom,
        productType: 'candle',
        markets: ['FR'],
      })

    const premier = await creer('DEMO Essai 1')
    const deuxieme = await creer('DEMO Essai 2')
    const troisieme = await creer('DEMO Essai 3')
    expect([premier.ok, deuxieme.ok, troisieme.ok]).toEqual([true, true, true])
    if (!premier.ok) return

    const quatrieme = await creer('DEMO Essai 4')
    expect(quatrieme.ok).toBe(false)
    if (quatrieme.ok) return
    expect(quatrieme.error.code).toBe('QUOTA_EXCEEDED')

    // Archiver libère un produit actif, mais pas le compteur cumulatif :
    // le quota de l'offre gratuite n'est pas renouvelable.
    const archive = await archiveProduct(deps, contexteGratuit, {
      productId: premier.value.productId,
      archive: true,
    })
    expect(archive.ok).toBe(true)

    const cinquieme = await creer('DEMO Essai 5')
    expect(cinquieme.ok).toBe(false)
    if (cinquieme.ok) return
    expect(cinquieme.error.code).toBe('QUOTA_EXCEEDED')

    // Le produit archivé disparaît de la liste courante, sans être supprimé.
    const actifs = await deps.db.withContext(
      { userId: atelier.userGratuit, organizationId: atelier.orgGratuite },
      (client) => listProducts(client, atelier.orgGratuite),
    )
    expect(actifs.map((p) => p.name)).not.toContain('DEMO Essai 1')

    const tous = await deps.db.withContext(
      { userId: atelier.userGratuit, organizationId: atelier.orgGratuite },
      (client) => listProducts(client, atelier.orgGratuite, { includeArchived: true }),
    )
    expect(tous.map((p) => p.name)).toContain('DEMO Essai 1')
  })

  it('ne propose que les matières de l’organisation, avec leur fiche validée', async () => {
    const matieres = await deps.db.withContext(
      { userId: atelier.user, organizationId: atelier.org },
      (client) => listSelectableMaterials(client, atelier.org),
    )
    expect(matieres.map((m) => m.name)).not.toContain('DEMO Cire')

    const parfum = matieres.find((m) => m.id === atelier.parfumA)
    expect(parfum?.validated_sds_version_id).toBe(atelier.versionFiche)
    expect(parfum?.validated_sds_label).toBe('1.0')

    // Une matière sans fiche reste sélectionnable : la recette se construit
    // avant que tous les documents soient réunis.
    const sansFiche = matieres.find((m) => m.id === atelier.parfumB)
    expect(sansFiche).toBeDefined()
    expect(sansFiche?.validated_sds_version_id).toBeNull()
  })

  it('refuse d’enregistrer une recette sur le produit d’une autre organisation', async () => {
    const cree = await createProduct(deps, contexte, {
      name: 'DEMO Bougie Cloisonnée',
      productType: 'candle',
      markets: ['FR'],
    })
    expect(cree.ok).toBe(true)
    if (!cree.ok) return

    const resultat = await saveRecipe(deps, contexteGratuit, {
      productId: cree.value.productId,
      ingredients: [
        { rawMaterialId: atelier.cireGratuite, sdsVersionId: null, percent: 100, role: 'wax' },
      ],
    })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.code).toBe('NOT_FOUND')
  })
})
