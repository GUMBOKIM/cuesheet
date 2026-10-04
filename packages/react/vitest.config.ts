import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Resolve cuesheet to the workspace source instead of the built dist
    conditions: ['@cuesheet/source'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts'],
  },
})
