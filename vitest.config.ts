import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  server: {
    fs: {
      strict: false
    }
  },
  test: {
    environment: 'nuxt',
    globals: true,
    include: ['src/__tests__/**/*.test.ts']
  }
})
