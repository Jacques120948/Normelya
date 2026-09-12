import { expect, test, type Page } from '@playwright/test'

/**
 * Parcours d'authentification, de bout en bout.
 *
 * Inscription, onboarding, tableau de bord, déconnexion, reconnexion,
 * suppression de compte. Exécuté dans un navigateur réel contre une base réelle.
 */

/** Adresse unique par exécution : les tests ne se marchent pas dessus. */
function adresseUnique(prefixe: string): string {
  return `${prefixe}-${Date.now()}-${Math.floor(Math.random() * 10000)}@exemple.test`
}

const MOT_DE_PASSE = 'motdepasse-de-test-123'

async function inscrire(page: Page, email: string) {
  await page.goto('/inscription')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill(MOT_DE_PASSE)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte e-mail' })).toBeVisible()
}

async function connecter(page: Page, email: string) {
  await page.goto('/connexion')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill(MOT_DE_PASSE)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

async function configurerAtelier(page: Page) {
  await expect(page).toHaveURL(/\/bienvenue/)
  await expect(page.getByRole('heading', { name: 'Bienvenue sur Normelya' })).toBeVisible()

  await page.getByRole('textbox', { name: 'Prénom' }).fill('Camille')
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Durand')
  await page.getByRole('textbox', { name: "Nom de l'entreprise / atelier" }).fill('DEMO Atelier de test')
  await page.getByRole('combobox', { name: 'Pays' }).selectOption('FR')
  await page.getByRole('combobox', { name: 'Que fabriquez-vous ?' }).selectOption('both')
  await page.getByRole('textbox', { name: 'Adresse professionnelle' }).fill('12 rue des Artisans')
  await page.getByRole('textbox', { name: 'Code postal' }).fill('69003')
  await page.getByRole('textbox', { name: 'Ville' }).fill('Lyon')
  await page.getByRole('button', { name: 'Accéder à Normelya' }).click()
}

test('un visiteur non connecté est renvoyé vers la connexion', async ({ page }) => {
  await page.goto('/tableau-de-bord')
  await expect(page).toHaveURL(/\/connexion/)
})

test("parcours complet : inscription, atelier, déconnexion, reconnexion", async ({ page }) => {
  const email = adresseUnique('parcours')

  await inscrire(page, email)
  await connecter(page, email)
  await configurerAtelier(page)

  // Le tableau de bord salue l'utilisateur et affiche des compteurs à zéro.
  await expect(page).toHaveURL(/\/tableau-de-bord/)
  await expect(page.getByRole('heading', { name: /Bonjour Camille/ })).toBeVisible()
  await expect(page.getByText('Votre atelier est prêt.')).toBeVisible()

  // L'offre gratuite est celle attribuée par défaut.
  await expect(page.getByText('Gratuit').first()).toBeVisible()

  // Déconnexion, puis accès refusé.
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page).toHaveURL(/\/connexion/)
  await page.goto('/matieres-premieres')
  await expect(page).toHaveURL(/\/connexion/)

  // Reconnexion : l'atelier est retrouvé, l'onboarding n'est pas redemandé.
  await connecter(page, email)
  await expect(page).toHaveURL(/\/tableau-de-bord/)
  await expect(page.getByRole('heading', { name: /Bonjour Camille/ })).toBeVisible()
})

test('un mot de passe incorrect ne révèle pas si le compte existe', async ({ page }) => {
  const email = adresseUnique('secret')
  await inscrire(page, email)

  await page.goto('/connexion')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(email)
  await page.locator('#password').fill('mauvais-mot-de-passe')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  const alerteFormulaire = page.getByRole('alert').filter({ hasText: /\S/ })
  const messageCompteConnu = (await alerteFormulaire.textContent())?.trim()

  await page.goto('/connexion')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(adresseUnique('inconnu'))
  await page.locator('#password').fill('mauvais-mot-de-passe')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  const messageCompteInconnu = (
    await page.getByRole('alert').filter({ hasText: /\S/ }).textContent()
  )?.trim()

  expect(messageCompteConnu).toBe('Adresse e-mail ou mot de passe incorrect.')
  expect(messageCompteInconnu).toBe(messageCompteConnu)
})

test('la demande de réinitialisation répond pareil pour une adresse inconnue', async ({ page }) => {
  await page.goto('/mot-de-passe-oublie')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(adresseUnique('jamais-inscrit'))
  await page.getByRole('button', { name: 'Réinitialiser mon mot de passe' }).click()
  await expect(page.getByText(/un lien de réinitialisation vient d’être envoyé/)).toBeVisible()
})

test('le formulaire refuse un mot de passe trop court', async ({ page }) => {
  await page.goto('/inscription')
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill(adresseUnique('court'))
  await page.locator('#password').fill('court')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByText('Au moins 12 caractères.')).toBeVisible()
})

test('suppression de compte : confirmation exigée, puis accès révoqué', async ({ page }) => {
  const email = adresseUnique('suppression')
  await inscrire(page, email)
  await connecter(page, email)
  await configurerAtelier(page)

  await page.goto('/parametres')
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click()

  // Une confirmation incorrecte ne supprime rien.
  await page.getByRole('textbox', { name: 'Saisissez SUPPRIMER pour confirmer' }).fill('oui')
  await page.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText('SUPPRIMER')

  await page.getByRole('textbox', { name: 'Saisissez SUPPRIMER pour confirmer' }).fill('SUPPRIMER')
  await page.getByRole('button', { name: 'Supprimer définitivement mon compte' }).click()

  await expect(page).toHaveURL(/\/connexion/)

  // Le compte n'existe plus : la reconnexion échoue.
  await connecter(page, email)
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toContainText('incorrect')
})
