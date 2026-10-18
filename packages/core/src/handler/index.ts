import type { HttpHandler } from 'msw'

/** A scenario branch. Each scenario has its own HttpHandler; the first one is the default */
export interface ScenarioHandler {
  /** Scenario name. Stored in the state, written in `?cue=` links and passed to `select()` */
  scenario: string
  /** What the panel shows for it. Defaults to the name — set it when a friendlier label would help */
  label?: string
  handler: HttpHandler
}

/** Definition of a single API the app registers with cuesheet */
export interface CueHandler {
  /** Unique identifier, used as the state key */
  id: string
  /** Name shown in the UI */
  label: string
  /** API path shown in the panel and the catalog, and used for sorting. Matching uses the msw handler's URL */
  path: string
  /** Page routes that use this API. For filtering in the UI */
  pages?: string[]
  /** An HttpHandler for a single response, or an array for scenario branches */
  handler: HttpHandler | ScenarioHandler[]
}

export { collectHandlers } from './collect'
export { type CueEntry, type ScenarioOption, toCatalog } from './meta'
export type { CueRegistry, HandlerId, ScenarioName, ScenarioOf, SelectArgs } from './registry'
export { assertSelectable, isScenarioHandler, selectHandler } from './scenario'
export { assertValidHandlers } from './validate'
