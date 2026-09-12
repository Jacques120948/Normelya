import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/web/src/server/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts'],
      // Le moteur réglementaire est tenu à un niveau de couverture supérieur
      // au reste du code : voir docs/04-moteur-reglementaire.md § 4.8.
      thresholds: {
        'packages/regulatory-engine/src/**': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
})
