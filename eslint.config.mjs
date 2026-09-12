import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Scripts Node exécutés en ligne de commande.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
    rules: { 'no-console': 'off' },
  },
  {
    // Le moteur réglementaire ne doit dépendre de rien : aucun import relatif
    // hors du paquet, aucune API d'entrée/sortie, aucune source de non-déterminisme.
    files: ['packages/regulatory-engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Le moteur doit recevoir la date en entrée (evaluatedAt).' },
        { name: 'fetch', message: "Le moteur ne fait aucune entrée/sortie." },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Le moteur doit être déterministe.' },
        { object: 'Date', property: 'now', message: 'Le moteur doit recevoir la date en entrée.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'next', 'next/*'], message: "Le moteur est indépendant de l'interface." },
            { group: ['node:*', 'fs', 'path', 'http', 'https'], message: "Le moteur ne fait aucune entrée/sortie." },
          ],
        },
      ],
    },
  },
)
