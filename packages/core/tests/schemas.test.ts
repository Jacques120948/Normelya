import { describe, expect, it } from 'vitest'
import {
  MAX_UPLOAD_BYTES,
  onboardingSchema,
  passwordSchema,
  recipeSchema,
  signUpSchema,
  uploadMetadataSchema,
} from '../src/schemas'

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

describe('inscription', () => {
  it('normalise l’adresse e-mail en minuscules et sans espaces', () => {
    const parsed = signUpSchema.parse({
      email: '  Jean.Dupont@Exemple.FR ',
      password: 'motdepassecorrect',
      acceptTerms: true,
    })
    expect(parsed.email).toBe('jean.dupont@exemple.fr')
  })

  it('exige l’acceptation des conditions', () => {
    const result = signUpSchema.safeParse({
      email: 'jean@exemple.fr',
      password: 'motdepassecorrect',
      acceptTerms: false,
    })
    expect(result.success).toBe(false)
  })

  it('exige 12 caractères minimum', () => {
    expect(passwordSchema.safeParse('court').success).toBe(false)
    expect(passwordSchema.safeParse('douzecaract!').success).toBe(true)
  })
})

describe('onboarding', () => {
  const valide = {
    firstName: 'Jean',
    lastName: 'Dupont',
    organizationName: 'Atelier Fleur de Coton',
    country: 'FR',
    activity: 'both',
    addressLine1: '12 rue des Artisans',
    postalCode: '69003',
    city: 'Lyon',
    contactEmail: 'contact@exemple.fr',
  }

  it('accepte un atelier français complet', () => {
    expect(onboardingSchema.safeParse(valide).success).toBe(true)
  })

  it('n’accepte que la France et la Suisse en V1', () => {
    expect(onboardingSchema.safeParse({ ...valide, country: 'CH' }).success).toBe(true)
    expect(onboardingSchema.safeParse({ ...valide, country: 'BE' }).success).toBe(false)
  })

  it('rend le téléphone facultatif', () => {
    expect(onboardingSchema.safeParse({ ...valide, contactPhone: '' }).success).toBe(true)
    expect(onboardingSchema.safeParse({ ...valide, contactPhone: '+41 79 000 00 00' }).success).toBe(
      true,
    )
    expect(onboardingSchema.safeParse({ ...valide, contactPhone: 'appelez-moi' }).success).toBe(
      false,
    )
  })
})

describe('recette', () => {
  const ingredient = (id: number, percent: number) => ({
    rawMaterialId: uuid(id),
    sdsVersionId: null,
    percent,
    role: 'wax' as const,
  })

  it('accepte une recette dont le total vaut exactement 100 %', () => {
    const result = recipeSchema.safeParse({
      ingredients: [ingredient(1, 91), { ...ingredient(2, 9), role: 'fragrance' as const }],
    })
    expect(result.success).toBe(true)
  })

  it('refuse une recette dont le total n’est pas 100 %', () => {
    const result = recipeSchema.safeParse({ ingredients: [ingredient(1, 91), ingredient(2, 8)] })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('inattendu')
    expect(result.error.issues[0]?.message).toContain('exactement 100 %')
  })

  it('refuse deux fois la même matière première', () => {
    const result = recipeSchema.safeParse({ ingredients: [ingredient(1, 50), ingredient(1, 50)] })
    expect(result.success).toBe(false)
    if (result.success) throw new Error('inattendu')
    expect(result.error.issues[0]?.message).toContain('une seule fois')
  })

  it('refuse une recette vide', () => {
    expect(recipeSchema.safeParse({ ingredients: [] }).success).toBe(false)
  })
})

describe('dépôt de fichier', () => {
  it('n’accepte que le PDF', () => {
    expect(
      uploadMetadataSchema.safeParse({
        filename: 'fds.pdf',
        mimeType: 'application/pdf',
        byteSize: 1024,
      }).success,
    ).toBe(true)
    expect(
      uploadMetadataSchema.safeParse({
        filename: 'image.png',
        mimeType: 'image/png',
        byteSize: 1024,
      }).success,
    ).toBe(false)
  })

  it('refuse un nom de fichier contenant un chemin', () => {
    const result = uploadMetadataSchema.safeParse({
      filename: '../../etc/passwd',
      mimeType: 'application/pdf',
      byteSize: 1024,
    })
    expect(result.success).toBe(false)
  })

  it('refuse un fichier au-delà de 20 Mo', () => {
    expect(
      uploadMetadataSchema.safeParse({
        filename: 'fds.pdf',
        mimeType: 'application/pdf',
        byteSize: MAX_UPLOAD_BYTES + 1,
      }).success,
    ).toBe(false)
  })
})
