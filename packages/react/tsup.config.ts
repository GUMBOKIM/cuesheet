import { defineConfig } from 'tsup'
import { version } from './package.json'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Only hooks and components, so mark it as a client boundary for the Next.js App Router and similar.
  // treeshake (rollup) strips top-of-module directives, so it's off
  banner: { js: "'use client'" },
  external: ['react', 'cuesheet'],
  // Shown in the panel header, so a bug report can say which version it was
  define: { __CUESHEET_VERSION__: JSON.stringify(version) },
})
