import { z } from 'zod'
import { MARKETS, PRODUCT_TYPES, RAW_MATERIAL_CATEGORIES } from './markets.js'
import { ORGANIZATION_ROLES } from './identity.js'
import { PLAN_CODES } from './plans.js'
import { checkRecipeTotal } from './percent.js'

/**
 * Schémas de validation partagés.
 *
 * Toute entrée traversant la frontière serveur est validée ici. Le client n'est
 * jamais considéré comme digne de confiance : les mêmes schémas sont réutilisés
 * côté interface pour le confort, mais la validation qui fait foi est celle
 * exécutée sur le serveur.
 */

export const uuidSchema = z.string().uuid("Identifiant invalide.")

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Adresse e-mail requise.')
  .max(254, 'Adresse e-mail trop longue.')
  .email('Adresse e-mail invalide.')
  .transform((value) => value.toLowerCase())

/**
 * Politique de mot de passe : la longueur prime sur la complexité imposée.
 * 12 caractères minimum, aucune exigence de caractère spécial (qui pousse aux
 * mots de passe faibles et mémorisés sur un papier).
 */
export const passwordSchema = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères.')
  .max(200, 'Le mot de passe est trop long.')
  .refine((value) => value.trim().length === value.length || value.trim().length >= 12, {
    message: 'Le mot de passe ne peut pas être composé uniquement d’espaces.',
  })

export const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Numéro de téléphone trop long.')
  .regex(/^[+0-9 ().-]*$/, 'Numéro de téléphone invalide.')

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Vous devez accepter les conditions d'utilisation." }),
  }),
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis.'),
})
export type SignInInput = z.infer<typeof signInSchema>

export const requestPasswordResetSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Lien de réinitialisation invalide.'),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Les deux mots de passe ne correspondent pas.',
  })

export const deleteAccountSchema = z.object({
  confirmation: z.literal('SUPPRIMER', {
    errorMap: () => ({ message: 'Saisissez SUPPRIMER pour confirmer.' }),
  }),
})

export const COUNTRIES = ['FR', 'CH'] as const
export const activitySchema = z.enum(['candles', 'wax_melts', 'both'])

export const onboardingSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis.').max(80),
  lastName: z.string().trim().min(1, 'Nom requis.').max(80),
  organizationName: z.string().trim().min(2, "Nom de l'atelier requis.").max(120),
  country: z.enum(COUNTRIES, {
    errorMap: () => ({ message: 'Sélectionnez France ou Suisse.' }),
  }),
  activity: activitySchema,
  addressLine1: z.string().trim().min(3, 'Adresse requise.').max(160),
  addressLine2: z.string().trim().max(160).optional().or(z.literal('')),
  postalCode: z.string().trim().min(4, 'Code postal requis.').max(12),
  city: z.string().trim().min(1, 'Ville requise.').max(100),
  contactEmail: emailSchema,
  contactPhone: phoneSchema.optional().or(z.literal('')),
})
export type OnboardingInput = z.infer<typeof onboardingSchema>

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(ORGANIZATION_ROLES).exclude(['owner']),
})

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Nom du fournisseur requis.').max(160),
  website: z.string().trim().url('Adresse du site invalide.').max(300).optional().or(z.literal('')),
  contactEmail: emailSchema.optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export const rawMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Nom de la matière requis.').max(160),
  category: z.enum(RAW_MATERIAL_CATEGORIES),
  supplierId: uuidSchema.optional().nullable(),
  internalReference: z.string().trim().max(80).optional().or(z.literal('')),
  purchasePriceCents: z.number().int().min(0).optional().nullable(),
  purchaseQuantity: z.number().positive().optional().nullable(),
  purchaseUnit: z.enum(['g', 'kg', 'ml', 'l', 'unit']).optional().nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})
export type RawMaterialInput = z.infer<typeof rawMaterialSchema>

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Nom du produit requis.').max(160),
  productType: z.enum(PRODUCT_TYPES),
  markets: z.array(z.enum(MARKETS)).min(1, 'Sélectionnez au moins un marché.'),
  netWeightGrams: z.number().positive('Le poids doit être supérieur à zéro.').max(100000).optional(),
  containerDescription: z.string().trim().max(200).optional().or(z.literal('')),
})
export type ProductInput = z.infer<typeof productSchema>

export const recipeIngredientSchema = z.object({
  rawMaterialId: uuidSchema,
  sdsVersionId: uuidSchema.nullable(),
  percent: z
    .number()
    .gt(0, 'Le pourcentage doit être supérieur à zéro.')
    .max(100, 'Le pourcentage ne peut pas dépasser 100.'),
  role: z.enum(['wax', 'fragrance', 'dye', 'additive', 'other']),
})

export const recipeSchema = z
  .object({
    ingredients: z.array(recipeIngredientSchema).min(1, 'Ajoutez au moins une matière première.'),
  })
  .superRefine((value, ctx) => {
    const ids = value.ingredients.map((ingredient) => ingredient.rawMaterialId)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingredients'],
        message: 'Une même matière première ne peut être ajoutée qu’une seule fois.',
      })
    }
    const check = checkRecipeTotal(value.ingredients.map((ingredient) => ingredient.percent))
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingredients'],
        message: `Le total de la recette doit être exactement 100 %. ${check.message}`,
      })
    }
  })
export type RecipeInput = z.infer<typeof recipeSchema>

export const subscriptionChangeSchema = z.object({
  plan: z.enum(PLAN_CODES),
  interval: z.enum(['month', 'year']),
})

/** Types de fichiers acceptés à l'import, vérifiés aussi par les octets d'en-tête. */
export const ACCEPTED_UPLOAD_MIME_TYPES = ['application/pdf'] as const
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export const uploadMetadataSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !value.includes('/') && !value.includes('\\') && !value.includes('\0'), {
      message: 'Nom de fichier invalide.',
    }),
  mimeType: z.enum(ACCEPTED_UPLOAD_MIME_TYPES, {
    errorMap: () => ({ message: 'Seuls les fichiers PDF sont acceptés.' }),
  }),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, 'Le fichier dépasse la taille maximale de 20 Mo.'),
})
