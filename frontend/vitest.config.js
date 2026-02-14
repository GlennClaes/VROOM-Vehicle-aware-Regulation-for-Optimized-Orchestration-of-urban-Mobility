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
        provider: 'v8', // v8 is sneller, maar zorg dat dit matcht met je 'istanbul' voorkeur
        reporter: ['text', 'lcov', 'html'], // Voeg 'html' toe voor visuele hulp!
        exclude: [
        'src/main.js'
        ],
        include: ['src/**/*.{js,ts,vue}'],
        all: true,
        // Voeg dit toe om de 80% echt af te dwingen:
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80
        }
      }
    }
  })
)
