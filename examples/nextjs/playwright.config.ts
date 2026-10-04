import { defineConfig, devices } from '@playwright/test'
// Give each worker its own PORT when running several at once (see examples/react/AGENTS.md).
// globalSetup refuses to run against a server that isn't this example, since reuseExistingServer
// would otherwise attach the suite to whatever happens to own the port
import { PORT } from './e2e/verifyServer'

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/verifyServer.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `pnpm next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
