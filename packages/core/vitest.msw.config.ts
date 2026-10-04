import { defineConfig } from 'vitest/config'

/**
 * The same suite against one specific msw, named by `CUESHEET_MSW` (an alias in devDependencies).
 * `pnpm test:msw` walks the range the peer dependency claims to support — otherwise the lower bound
 * is only a claim.
 *
 * The whole 2.x line was swept once, minor by minor: 2.1.3 up to the latest all pass, and 2.1.2 and
 * below fail because `getResponse` only appears in 2.1.3. That is exactly where the peer range
 * starts. msw 1.x is a different API and is not supported. The aliases kept here are a sample of
 * that range — the floor, the newest, and three points in between.
 */
const alias = process.env.CUESHEET_MSW

export default defineConfig({
  resolve: {
    alias: alias === undefined || alias === 'msw' ? {} : { msw: alias },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
  },
})
