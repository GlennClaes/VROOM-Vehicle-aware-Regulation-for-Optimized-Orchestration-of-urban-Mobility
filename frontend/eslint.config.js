import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tsParser from '@typescript-eslint/parser'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,js,mjs,jsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // For 'require' and 'global'
      },
    },
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'].map((config) => ({
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        parser: tsParser,
      },
    },
  })),

  {
    name: 'app/vue-rules',
    rules: {
      'vue/multi-word-component-names': 'off', // Allow Button, Input, etc.
      'vue/valid-template-root': 'off', // Allow empty templates for WIP components
      'no-unused-vars': 'warn', // Downgrade to warning
      'no-useless-assignment': 'off',
      'no-undef': 'warn', // Catch real issues but don't break the build if globals are missed
      'no-empty': 'warn', // Allow empty blocks (like in AuthStore.js) for now
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/**/*.spec.js', 'src/**/__tests__/**/*.test.js'],
    languageOptions: {
      globals: {
        ...pluginVitest.environments.env.globals,
        vi: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  skipFormatting,
])
