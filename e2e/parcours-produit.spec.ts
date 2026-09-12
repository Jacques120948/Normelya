import { expect, test, type Page } from '@playwright/test'

/**
 * Parcours d'un produit : création, composition de la recette, total imposé.
 *
 * Exécuté dans un navigateur réel, contre une vraie base. C'est le seul moyen
 * de vérifier que le total est bien calculé à la saisie et que l'écart est
 * affiché avant l'enregistrement.
 */

const MOT_DE_PASSE = 'motdepasse-de-test-123'

function adresseUnique(prefixe: string): string {
  return `${prefixe}-${Date.now()}-${Math.floor(Math.random() * 10000)}@exemple.test`
}

async function creerAtelier(page: Page): Promise<void> {
  const email = adresseUnique('produit')

  await page.goto('/inscription')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill(MOT_DE_PASSE)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()

  await page.goto('/connexion')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill(MOT_DE_PASSE)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page).toHaveURL(/\/bienvenue/)
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Camille')
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Durand')
  await page.getByRole('textbox', { name: "Nom de l'entreprise / atelier" }).fill('DEMO Atelier')
  await page.getByRole('textbox', { name: 'Adresse professionnelle' }).fill('12 rue des Artisans')
  await page.getByRole('textbox', { name: 'Code postal' }).fill('69003')
  await page.getByRole('textbox', { name: 'Ville' }).fill('Lyon')
  await page.getByRole('button', { name: 'Accéder à Normelya' }).click()
  await expect(page).toHaveURL(/\/tableau-de-bord/)
}

async function creerMatiere(page: Page, nom: string, categorie: string): Promise<void> {
  await page.goto('/matieres-premieres/nouvelle')
  await page.getByRole('textbox', { name: 'Nom' }).first().fill(nom)
  await page.getByLabel('Type').selectOption(categorie)
  await page.getByRole('button', { name: 'Ajouter la matière' }).click()
  await expect(page.getByRole('heading', { name: nom })).toBeVisible()
}

/** Remplit la ligne de recette d'indice donné. */
async function remplirLigne(
  page: Page,
  index: number,
  matiere: string,
  pourcentage: string,
): Promise<void> {
  await page.locator(`select[name="ingredients[${index}][rawMaterialId]"]`).selectOption({
    label: matiere,
  })
  await page.locator(`input[name="ingredients[${index}][percent]"]`).fill(pourcentage)
}

test('création d’un produit et composition de sa recette', async ({ page }) => {
  await creerAtelier(page)
  await creerMatiere(page, 'DEMO Cire de soja', 'wax')
  await creerMatiere(page, 'DEMO Parfum Fleur', 'fragrance')
  await creerMatiere(page, 'DEMO Parfum Bois', 'fragrance')

  await page.goto('/produits')
  await expect(page.getByText('Aucun produit enregistré.')).toBeVisible()

  // Deux liens mènent à la création : celui de l'en-tête et celui de l'état vide.
  await page.locator('header').getByRole('link', { name: 'Nouveau produit' }).click()
  await page.getByRole('textbox', { name: 'Nom du produit' }).fill('DEMO Bougie Ambre')
  await page.getByRole('checkbox', { name: 'Suisse' }).check()
  await page.getByLabel('Poids net (g)').fill('180')
  await page.getByRole('button', { name: 'Nouveau produit' }).click()

  await expect(page.getByRole('heading', { name: 'DEMO Bougie Ambre' })).toBeVisible()
  await expect(page.getByText('France, Suisse')).toBeVisible()

  // Première ligne : la cire. Le rôle suit la catégorie de la matière choisie.
  await remplirLigne(page, 0, 'DEMO Cire de soja', '88,5')
  await expect(page.locator('select[name="ingredients[0][role]"]')).toHaveValue('wax')

  // Le total est calculé à la saisie et l'écart affiché avant toute écriture.
  await expect(page.getByText('88,5 %')).toBeVisible()
  await expect(page.getByText('Il manque 11,5 % pour atteindre 100 %')).toBeVisible()

  await page.getByRole('button', { name: 'Ajouter une matière' }).click()
  await remplirLigne(page, 1, 'DEMO Parfum Fleur', '7,7')
  await page.getByRole('button', { name: 'Ajouter une matière' }).click()
  await remplirLigne(page, 2, 'DEMO Parfum Bois', '3,8')

  // Plusieurs parfums : le taux affiché est le cumul, pas celui d'un seul.
  await expect(page.getByText('Taux de parfum : 11,5 %')).toBeVisible()

  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Recette enregistrée.')).toBeVisible()

  // La recette est bien relue depuis la base après rechargement.
  await page.reload()
  await expect(page.locator('input[name="ingredients[0][percent]"]')).toHaveValue('88,5')
  await expect(page.locator('input[name="ingredients[2][percent]"]')).toHaveValue('3,8')

  await page.goto('/produits')
  await expect(page.getByRole('link', { name: 'DEMO Bougie Ambre' }).first()).toBeVisible()
  await expect(page.getByText('3 matières').first()).toBeVisible()
  await expect(page.getByText('Pas encore analysé').first()).toBeVisible()
})

test('refuse une recette dont le total n’atteint pas 100 %', async ({ page }) => {
  await creerAtelier(page)
  await creerMatiere(page, 'DEMO Cire de soja', 'wax')
  await creerMatiere(page, 'DEMO Parfum Fleur', 'fragrance')

  await page.goto('/produits/nouveau')
  await page.getByRole('textbox', { name: 'Nom du produit' }).fill('DEMO Bougie Incomplète')
  await page.getByRole('button', { name: 'Nouveau produit' }).click()
  await expect(page.getByRole('heading', { name: 'DEMO Bougie Incomplète' })).toBeVisible()

  await remplirLigne(page, 0, 'DEMO Cire de soja', '90')
  await page.getByRole('button', { name: 'Ajouter une matière' }).click()
  await remplirLigne(page, 1, 'DEMO Parfum Fleur', '9,9')

  await page.getByRole('button', { name: 'Enregistrer' }).click()

  // Le serveur refuse, et le message nomme l'écart plutôt que de dire « erreur ».
  await expect(page.getByText('Il manque 0,1 % pour atteindre 100 %')).toBeVisible()
  await expect(page.getByText('Recette enregistrée.')).toHaveCount(0)
})
