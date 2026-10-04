import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // cuesheet is a browser library. Relative handler paths resolve against the
    // origin, which requires a document
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
  },
})
