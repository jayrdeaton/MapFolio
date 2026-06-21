const { defineConfig } = require('eslint/config')
const prettierRecommended = require('eslint-plugin-prettier/recommended')
const simpleImportSort = require('eslint-plugin-simple-import-sort')
const tsParser = require('@typescript-eslint/parser')
const tsEslint = require('typescript-eslint')
const vueParser = require('vue-eslint-parser')
const pluginVue = require('eslint-plugin-vue')

module.exports = defineConfig([
  {
    ignores: ['.nuxt/**', '.output/**', 'node_modules/**', 'coverage/**', 'dist/**', '**/*.mjs', '**/*.cjs']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        extraFileExtensions: ['.vue']
      }
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.vue']
      }
    }
  },
  ...tsEslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettierRecommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      'prettier/prettier': 'warn',
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    // Renderless components: they drive Leaflet imperatively and render no DOM, so an empty
    // <template> is intentional. vue/valid-template-root requires a single root element.
    files: ['src/components/PinMarker.vue', 'src/components/PrintAreaDrawer.vue', 'src/components/CaptionMarker.vue', 'src/components/CaptionRotateHandle.vue'],
    rules: {
      'vue/valid-template-root': 'off'
    }
  }
])
