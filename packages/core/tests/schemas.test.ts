import { describe, expect, it } from 'vitest'
import {
  MAX_UPLOAD_BYTES,
  onboardingSchema,
  passwordSchema,
  recipeSchema,
  signUpSchema,
  totalFragranceLoad,
  uploadMetadataSchema,
  VALIDATION_STATEMENT,
  validateSdsSchema,
  validatedSubstanceSchema,
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

describe('taux de parfum', () => {
  const parfum = (percent: number) => ({
    rawMaterialId: uuid(2),
    sdsVersionId: null,
    percent,
    role: 'fragrance' as const,
  })
  const cire = (percent: number) => ({
    rawMaterialId: uuid(1),
    sdsVersionId: null,
    percent,
    role: 'wax' as const,
  })

  it('accepte n’importe quelle valeur entre 0,1 et 30 %, pas seulement des paliers', () => {
    for (const taux of [0.1, 3, 6.5, 7.3, 9.9, 12.75, 30]) {
      const resultat = recipeSchema.safeParse({
        ingredients: [cire(100 - taux), parfum(taux)],
      })
      expect(resultat.success, `taux ${taux} refusé`).toBe(true)
    }
  })

  it('refuse un taux de parfum sous 0,1 % ou au-delà de 30 %', () => {
    const trop_bas = recipeSchema.safeParse({ ingredients: [cire(99.95), parfum(0.05)] })
    expect(trop_bas.success).toBe(false)

    const trop_haut = recipeSchema.safeParse({ ingredients: [cire(65), parfum(35)] })
    expect(trop_haut.success).toBe(false)
    if (trop_haut.success) throw new Error('inattendu')
    expect(trop_haut.error.issues.some((i) => i.message.includes('30 %'))).toBe(true)
  })

  it('n’applique ces bornes qu’aux parfums', () => {
    // Une cire à 99,9 % est parfaitement normale.
    const resultat = recipeSchema.safeParse({ ingredients: [cire(99.9), parfum(0.1)] })
    expect(resultat.success).toBe(true)
  })

  it('accepte plusieurs parfums dans une même recette', () => {
    const resultat = recipeSchema.safeParse({
      ingredients: [
        cire(88),
        parfum(7),
        { rawMaterialId: uuid(3), sdsVersionId: null, percent: 4, role: 'fragrance' as const },
        { rawMaterialId: uuid(4), sdsVersionId: null, percent: 1, role: 'dye' as const },
      ],
    })
    expect(resultat.success).toBe(true)
  })

  it('calcule le taux de parfum cumulé, tous parfums confondus', () => {
    expect(
      totalFragranceLoad([
        { role: 'wax', percent: 88 },
        { role: 'fragrance', percent: 7 },
        { role: 'fragrance', percent: 4 },
        { role: 'dye', percent: 1 },
      ]),
    ).toBe(11)
  })
})

describe('fiche de données de sécurité validée', () => {
  const substance = {
    declaredName: 'DEMO Substance A',
    casNumber: '78-70-6',
    ecNumber: '201-134-4',
    concentrationMin: 5,
    concentrationMax: 10,
    concentrationExact: null,
    classificationText: 'Skin Sens. 1',
    hazardStatements: ['H317'],
  }

  const fiche = {
    commercialName: 'DEMO Parfum',
    supplierName: 'DEMO Maison des Parfums',
    versionLabel: '2.0',
    revisionDate: '2026-03-12',
    language: 'fr',
    flashPointCelsius: 93,
    hazardStatements: ['H317'],
    euhStatements: [],
    precautionaryStatements: ['P280'],
    substances: [substance],
  }

  it('accepte une fiche vérifiée complète', () => {
    expect(validateSdsSchema.safeParse({ payload: fiche, confirmed: true }).success).toBe(true)
  })

  it('exige la confirmation, même si tout le reste est correct', () => {
    const resultat = validateSdsSchema.safeParse({ payload: fiche, confirmed: false })
    expect(resultat.success).toBe(false)
    if (resultat.success) throw new Error('inattendu')
    expect(resultat.error.issues[0]?.message).toContain('Confirmez avoir vérifié')
  })

  it('conserve une plage sans exiger de valeur exacte', () => {
    const resultat = validatedSubstanceSchema.safeParse(substance)
    expect(resultat.success).toBe(true)
    if (!resultat.success) return
    expect(resultat.data.concentrationMin).toBe(5)
    expect(resultat.data.concentrationMax).toBe(10)
    expect(resultat.data.concentrationExact).toBeNull()
  })

  it('refuse une substance sans aucune concentration déclarée', () => {
    const resultat = validatedSubstanceSchema.safeParse({
      ...substance,
      concentrationMin: null,
      concentrationMax: null,
      concentrationExact: null,
    })
    expect(resultat.success).toBe(false)
    if (resultat.success) return
    expect(resultat.error.issues[0]?.message).toContain('Indiquez une concentration')
  })

  it('refuse une plage incohérente', () => {
    const resultat = validatedSubstanceSchema.safeParse({
      ...substance,
      concentrationMin: 10,
      concentrationMax: 5,
    })
    expect(resultat.success).toBe(false)
  })

  it('refuse un numéro CAS mal formé', () => {
    expect(validatedSubstanceSchema.safeParse({ ...substance, casNumber: '78706' }).success).toBe(
      false,
    )
  })

  it('accepte une fiche sans substance déclarée, sans en inventer', () => {
    const resultat = validateSdsSchema.safeParse({
      payload: { ...fiche, substances: [] },
      confirmed: true,
    })
    expect(resultat.success).toBe(true)
    if (!resultat.success) return
    expect(resultat.data.payload.substances).toEqual([])
  })

  it('fixe le texte exact de la déclaration acceptée', () => {
    expect(VALIDATION_STATEMENT).toBe('Je confirme avoir vérifié ces informations.')
  })
})
