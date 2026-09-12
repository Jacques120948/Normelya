import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de bout en bout.
 *
 * Ils s'exécutent contre l'application réellement démarrée, avec une vraie base
 * PostgreSQL et un vrai navigateur : c'est la seule façon de vérifier qu'un
 * parcours fonctionne, par opposition aux tests unitaires qui vérifient qu'une
 * fonction fonctionne.
 *
 * Le serveur est démarré par Playwright s'il ne tourne pas déjà.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Le navigateur est fourni par l'environnement plutôt que téléchargé.
        // PLAYWRIGHT_CHROMIUM_PATH permet de le désigner quand la version de
        // Playwright et celle des binaires installés ne coïncident pas.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  // Un serveur de développement est démarré au besoin. Lorsque E2E_BASE_URL est
  // fourni, les tests visent un serveur déjà lancé — notamment le build de
  // production, qu'on ne veut surtout pas remplacer par un serveur de
  // développement à la politique de contenu plus permissive.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev --workspace @normelya/web',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
})
