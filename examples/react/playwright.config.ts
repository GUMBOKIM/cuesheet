import { defineConfig, devices } from '@playwright/test'
// When several workers run on one machine at once, give each its own PORT — with
// reuseExistingServer, a shared port attaches tests to someone else's dev server (another worktree).
// globalSetup refuses to run against a server that isn't this example, so that can't pass unnoticed
import { PORT } from './e2e/verifyServer'

/**
 * baseline — current v1 behaviour. Must always pass.
 * cr       — acceptance criteria of the change requests (requirements/CR-*.md). Failing until implemented.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/verifyServer.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'baseline', testDir: 'e2e/baseline' },
    { name: 'cr', testDir: 'e2e/cr' },
  ],
  webServer: {
    command: `pnpm vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
})
