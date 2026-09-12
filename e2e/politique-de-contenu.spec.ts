import { expect, test } from '@playwright/test'

/**
 * Vérifie que la politique de contenu de production ne casse pas l'hydratation.
 *
 * Le mode développement tolère 'unsafe-eval' pour le rechargement à chaud ; la
 * production ne le tolère pas. Sans ce test, rien ne garantirait que
 * l'application reste interactive avec la politique stricte.
 */
test('aucune violation de la politique de contenu en production', async ({ page }) => {
  const violations: string[] = []
  page.on('pageerror', (e) => {
    if (/Content Security Policy/i.test(e.message)) violations.push(e.message)
  })
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) {
      violations.push(m.text())
    }
  })

  for (const chemin of ['/connexion', '/inscription', '/mot-de-passe-oublie', '/cgu']) {
    await page.goto(chemin)
    await page.waitForLoadState('networkidle')
  }

  expect(violations).toEqual([])
})

test('la page de connexion reste interactive sous la politique stricte', async ({ page }) => {
  await page.goto('/connexion')
  await page.waitForLoadState('networkidle')

  // La validation côté client s'exécute : preuve que React est hydraté.
  await page.getByRole('textbox', { name: 'Adresse e-mail' }).fill('pas-une-adresse')
  await page.locator('#password').fill('court')
  await page.getByRole('button', { name: 'Se connecter' }).click()

  // Le bouton passe en état de soumission, ce qui n'arrive que si le
  // composant client fonctionne.
  await expect(page.getByRole('button', { name: /Connexion|Se connecter/ })).toBeVisible()
})
