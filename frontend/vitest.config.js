import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      coverage: {
        provider: 'v8', // of 'istanbul' als je dat wilt
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{js,vue}'], // zorgt dat coverage je App.vue en andere src-bestanden pakt
        all: true
      }
    }
  })
)
