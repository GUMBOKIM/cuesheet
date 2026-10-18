import { defineConfig } from 'vitest/config'
import { version } from './package.json'

export default defineConfig({
  define: { __CUESHEET_VERSION__: JSON.stringify(version) },
  resolve: {
    // Resolve cuesheet to the workspace source instead of the built dist
    conditions: ['@cuesheet/source'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.tsx', 'src/**/*.spec.ts'],
  },
})
