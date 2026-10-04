import * as log from '../util/log'
import type { CueHandler } from './index'

function isCueHandler(value: unknown): value is CueHandler {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CueHandler).id === 'string' &&
    'handler' in value
  )
}

/**
 * Extracts handlers from modules gathered by the bundler. Use it to keep one file per API and register a whole folder.
 *
 * Reading the file system is the bundler's job, so cuesheet only takes the result — it works the same with any bundler.
 *
 * ```ts
 * // Vite
 * collectHandlers(import.meta.glob('./mocks/handlers/*.mock.ts', { eager: true }))
 *
 * // webpack
 * const context = require.context('./mocks/handlers', false, /\.mock\.ts$/)
 * collectHandlers(Object.fromEntries(context.keys().map((key) => [key, context(key)])))
 * ```
 *
 * Both default and named exports of each module are checked. A value may be a single handler or an array.
 * Files that export no handlers trigger a warning — so nothing silently goes missing when you think it's registered.
 * Order follows file paths, so it's the same on every build.
 */
export function collectHandlers(modules: Record<string, unknown>): CueHandler[] {
  const collected = new Set<CueHandler>()

  for (const path of Object.keys(modules).sort()) {
    const module = modules[path]
    const exported = typeof module === 'object' && module !== null ? Object.values(module) : []
    const found = exported.flat().filter(isCueHandler)
    if (found.length === 0) {
      log.warn(`No handlers found in '${path}'. Export a CueHandler.`)
    }
    for (const handler of found) {
      collected.add(handler)
    }
  }
  return [...collected]
}
