import {
  AppError,
  checkRecipeTotal,
  err,
  ok,
  productSchema,
  recipeSchema,
  type Market,
  type ProductInput,
  type RecipeInput,
  type RequestContext,
  type Result,
} from '@normelya/core'
import type { Database } from '../ports/database'
import { recordAudit } from '../security/audit'
import { requireRole } from '../security/request-context'
import { assertCanCreateProduct, incrementLifetimeCounter } from './quotas'

/**
 * Cas d'usage des produits et des recettes.
 *
 * Deux règles structurent ce module.
 *
 * 1. Une analyse porte sur une VERSION figée, jamais sur un produit modifiable.
 *    Tant qu'aucune analyse ne s'y rattache, la version courante se modifie
 *    librement. Dès qu'une analyse existe, la version est verrouillée et toute
 *    modification crée une nouvelle version. C'est ce qui permet de rejouer un
 *    résultat des années plus tard.
 *
 * 2. Le total d'une recette vaut exactement 100 %. Aucune tolérance implicite :
 *    une recette à 99,9 % est refusée et l'écart est affiché.
 */

export type ProductDeps = {
  db: Database
  serviceDb: Database
}

export type CreatedProduct = {
  productId: string
  productVersionId: string
}

export async function createProduct(
  deps: ProductDeps,
  context: RequestContext,
  input: ProductInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<CreatedProduct, AppError>> {
  requireRole(context, 'member')

  const analyse = productSchema.safeParse(input)
  if (!analyse.success) {
    return err(
      AppError.validation('Certaines informations sont incomplètes.', {
        issues: analyse.error.issues,
      }),
    )
  }
  const donnees = analyse.data

  try {
    const cree = await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        // Sur l'offre gratuite, deux plafonds s'appliquent : les produits
        // actifs et le total jamais créé, qui n'est pas renouvelable.
        await assertCanCreateProduct(client, {
          organizationId: context.organizationId,
          plan: context.plan,
        })

        const produit = await client.queryOne<{ id: string }>(
          `INSERT INTO products
             (organization_id, name, product_type, net_weight_grams,
              container_description, status, created_by)
           VALUES ($1, $2, $3, $4, $5, 'active', $6)
           RETURNING id`,
          [
            context.organizationId,
            donnees.name,
            donnees.productType,
            donnees.netWeightGrams ?? null,
            donnees.containerDescription || null,
            context.userId,
          ],
        )
        if (!produit) throw new AppError('INTERNAL', "Le produit n'a pas pu être créé.")

        const version = await creerVersion(client, {
          organizationId: context.organizationId,
          productId: produit.id,
          versionNumber: 1,
          name: donnees.name,
          netWeightGrams: donnees.netWeightGrams ?? null,
          markets: donnees.markets,
          createdBy: context.userId,
        })

        await client.query(`UPDATE products SET current_version_id = $2 WHERE id = $1`, [
          produit.id,
          version,
        ])

        return { productId: produit.id, productVersionId: version }
      },
    )

    // Le compteur cumulatif ne redescend jamais : archiver un produit ne libère
    // pas de place sur l'offre gratuite.
    await deps.serviceDb.transaction(async (client) => {
      await incrementLifetimeCounter(client, context.organizationId, 'lifetime_products')
      await recordAudit(client, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: 'product.created',
        entityType: 'product',
        entityId: cree.productId,
        after: { name: donnees.name, type: donnees.productType, markets: donnees.markets },
        ip: meta.ip,
        userAgent: meta.userAgent,
      })
    })

    return ok(cree)
  } catch (erreur) {
    return err(traduire(erreur))
  }
}

export type SavedRecipe = {
  productVersionId: string
  /** Vrai si une nouvelle version a dû être créée, la précédente étant figée. */
  createdNewVersion: boolean
  totalPercent: number
}

/**
 * Enregistre la recette de la version courante.
 *
 * Si cette version est verrouillée — une analyse s'y rattache — une nouvelle
 * version est créée et reçoit la recette. L'ancienne reste intacte, avec son
 * analyse.
 */
export async function saveRecipe(
  deps: ProductDeps,
  context: RequestContext,
  input: { productId: string; ingredients: RecipeInput['ingredients'] },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<SavedRecipe, AppError>> {
  requireRole(context, 'member')

  const analyse = recipeSchema.safeParse({ ingredients: input.ingredients })
  if (!analyse.success) {
    // Les anomalies portant sur un ingrédient précis s'affichent sur sa ligne.
    // Celles qui portent sur la recette entière — total, doublon — n'ont aucune
    // ligne où s'accrocher : elles doivent remonter dans le message principal,
    // sinon l'artisan voit un refus sans écart ni explication.
    const globales = analyse.error.issues
      .filter((issue) => issue.path.length <= 1)
      .map((issue) => issue.message)
    return err(
      AppError.validation(
        globales.length > 0
          ? globales.join(' ')
          : 'La recette ne peut pas être enregistrée en l’état.',
        { issues: analyse.error.issues },
      ),
    )
  }
  const ingredients = analyse.data.ingredients
  const total = checkRecipeTotal(ingredients.map((i) => i.percent))
  if (!total.valid) {
    return err(
      AppError.validation(`Le total de la recette doit être exactement 100 %. ${total.message}`),
    )
  }

  try {
    const resultat = await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        const produit = await client.queryOne<{
          id: string
          name: string
          net_weight_grams: string | null
          current_version_id: string | null
        }>(
          `SELECT id, name, net_weight_grams::text, current_version_id
           FROM products
           WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`,
          [context.organizationId, input.productId],
        )
        if (!produit) throw AppError.notFound("Ce produit n'existe pas.")
        if (!produit.current_version_id) {
          throw new AppError('INTERNAL', 'Ce produit n’a pas de version courante.')
        }

        const version = await client.queryOne<{
          id: string
          version_number: number
          markets: Market[]
          is_locked: boolean
        }>(
          `SELECT id, version_number, markets::text[] AS markets, is_locked
           FROM product_versions WHERE organization_id = $1 AND id = $2`,
          [context.organizationId, produit.current_version_id],
        )
        if (!version) throw new AppError('INTERNAL', 'Version courante introuvable.')

        let versionCible = version.id
        let nouvelleVersion = false

        if (version.is_locked) {
          // La version porte une analyse : elle est figée. La modification part
          // sur une nouvelle version, et l'ancienne reste rejouable.
          versionCible = await creerVersion(client, {
            organizationId: context.organizationId,
            productId: produit.id,
            versionNumber: version.version_number + 1,
            name: produit.name,
            netWeightGrams: produit.net_weight_grams ? Number(produit.net_weight_grams) : null,
            markets: version.markets,
            createdBy: context.userId,
          })
          await client.query(`UPDATE products SET current_version_id = $2 WHERE id = $1`, [
            produit.id,
            versionCible,
          ])
          nouvelleVersion = true
        }

        // La recette est réécrite intégralement : c'est un tout cohérent, pas
        // une accumulation de lignes.
        await client.query(`DELETE FROM recipes WHERE product_version_id = $1`, [versionCible])

        const recette = await client.queryOne<{ id: string }>(
          `INSERT INTO recipes (organization_id, product_version_id, total_percent)
           VALUES ($1, $2, $3) RETURNING id`,
          [context.organizationId, versionCible, total.total],
        )
        if (!recette) throw new AppError('INTERNAL', 'La recette n’a pas pu être enregistrée.')

        for (const [position, ingredient] of ingredients.entries()) {
          await client.query(
            `INSERT INTO recipe_ingredients
               (organization_id, recipe_id, raw_material_id, sds_version_id, percent, role, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              context.organizationId,
              recette.id,
              ingredient.rawMaterialId,
              ingredient.sdsVersionId,
              ingredient.percent,
              ingredient.role,
              position,
            ],
          )
        }

        await client.query(`UPDATE products SET updated_at = now() WHERE id = $1`, [produit.id])

        return {
          productVersionId: versionCible,
          createdNewVersion: nouvelleVersion,
          totalPercent: total.total,
        }
      },
    )

    await deps.serviceDb
      .transaction((client) =>
        recordAudit(client, {
          organizationId: context.organizationId,
          actorUserId: context.userId,
          action: 'recipe.updated',
          entityType: 'product_version',
          entityId: resultat.productVersionId,
          after: {
            ingredients: ingredients.length,
            createdNewVersion: resultat.createdNewVersion,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        }),
      )
      .catch(() => undefined)

    return ok(resultat)
  } catch (erreur) {
    return err(traduire(erreur))
  }
}

export async function archiveProduct(
  deps: ProductDeps,
  context: RequestContext,
  input: { productId: string; archive: boolean },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<Result<void, AppError>> {
  requireRole(context, 'member')

  try {
    const modifiees = await deps.db.withContext(
      { userId: context.userId, organizationId: context.organizationId },
      async (client) => {
        if (!input.archive) {
          // Réactiver consomme un emplacement : le quota de produits actifs
          // doit être vérifié comme à la création.
          await assertCanCreateProduct(client, {
            organizationId: context.organizationId,
            plan: context.plan,
          })
        }
        const lignes = await client.query<{ id: string }>(
          `UPDATE products SET status = $3
           WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL
           RETURNING id`,
          [context.organizationId, input.productId, input.archive ? 'archived' : 'active'],
        )
        return lignes.length
      },
    )

    if (modifiees === 0) return err(AppError.notFound("Ce produit n'existe pas."))

    await deps.serviceDb
      .transaction((client) =>
        recordAudit(client, {
          organizationId: context.organizationId,
          actorUserId: context.userId,
          action: 'product.archived',
          entityType: 'product',
          entityId: input.productId,
          after: { archived: input.archive },
          ip: meta.ip,
          userAgent: meta.userAgent,
        }),
      )
      .catch(() => undefined)

    return ok(undefined)
  } catch (erreur) {
    return err(traduire(erreur))
  }
}

async function creerVersion(
  client: { queryOne: Database['queryOne'] },
  input: {
    organizationId: string
    productId: string
    versionNumber: number
    name: string
    netWeightGrams: number | null
    markets: readonly Market[]
    createdBy: string
  },
): Promise<string> {
  const version = await client.queryOne<{ id: string }>(
    `INSERT INTO product_versions
       (organization_id, product_id, version_number, name_snapshot, net_weight_grams,
        markets, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.organizationId,
      input.productId,
      input.versionNumber,
      input.name,
      input.netWeightGrams,
      input.markets as Market[],
      input.createdBy,
    ],
  )
  if (!version) throw new AppError('INTERNAL', "La version du produit n'a pas pu être créée.")
  return version.id
}

function traduire(erreur: unknown): AppError {
  if (erreur instanceof AppError) return erreur

  const message = erreur instanceof Error ? erreur.message : String(erreur)

  if (message.includes('recipes_total_is_100')) {
    return AppError.validation('Le total de la recette doit être exactement 100 %.')
  }
  if (message.includes('recipe_ingredients_unique')) {
    return AppError.validation('Une même matière première ne peut être ajoutée qu’une seule fois.')
  }
  if (message.includes('product_versions_markets_not_empty')) {
    return AppError.validation('Sélectionnez au moins un marché.')
  }
  if (message.includes('row-level security')) return AppError.forbidden()

  console.error('Écriture de produit refusée', { message })
  return new AppError('INTERNAL', 'Une erreur est survenue. Réessayez dans un instant.')
}
