import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  server: {
    fs: {
      strict: false
    },
    allowedHosts: ['localhost', 'jays-macbook-pro.local']
  },
  test: {
    environment: 'nuxt',
    globals: true,
    include: ['src/__tests__/**/*.test.ts']
  }
})
