import type { CueHandler } from './index'
import { isScenarioHandler } from './scenario'

/** A scenario option for the UI dropdown */
export interface ScenarioOption {
  value: string
  label: string
}

/** What the UI and agents read to learn "what can be controlled". Projected from the definition (CueHandler) */
export interface CueEntry {
  label: string
  method: string
  path: string
  pages?: string[]
  /** The list of options, if this is a scenario handler */
  scenarios?: ScenarioOption[]
}

/** Handler definitions → catalog. Sorted by API path, keyed by id */
export function toCatalog(handlers: CueHandler[]): Record<string, CueEntry> {
  const sorted = [...handlers].sort((left, right) => left.path.localeCompare(right.path))

  return Object.fromEntries(
    sorted.map((meta) => {
      const { handler } = meta
      // For a scenario array, report the method of the first handler
      const representative = isScenarioHandler(handler) ? handler[0]?.handler : handler
      const method = representative?.info.method
      const entry: CueEntry = {
        label: meta.label,
        // `http.all()` matches any method with a RegExp
        method: typeof method === 'string' ? method.toUpperCase() : 'ALL',
        path: meta.path,
      }
      if (meta.pages !== undefined) {
        entry.pages = meta.pages
      }
      if (isScenarioHandler(handler)) {
        entry.scenarios = handler.map(({ scenario: value, label }) => ({ value, label: label ?? value }))
      }
      return [meta.id, entry]
    }),
  )
}
