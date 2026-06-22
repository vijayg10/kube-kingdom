/* Shared ESLint config for the Kube Kingdom monorepo (client + server). */
module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['client/**/*.{ts,tsx}'],
      extends: ['plugin:react-hooks/recommended'],
      rules: {
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      },
    },
  ],
  ignorePatterns: ['dist/', 'build/', 'node_modules/', '*.cjs'],
};
