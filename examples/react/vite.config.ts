import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // This example is linked to the workspace source. Vite keys its pre-bundle cache on the lockfile, not on
  // the source, so without this an edit in packages/core wouldn't reach the browser here — the e2e suite
  // would pass against the previous build. Apps installing from npm don't need it
  optimizeDeps: { force: true },
  plugins: [react()],
})
