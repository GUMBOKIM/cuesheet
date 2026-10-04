import type { DelayCondition, NetworkCondition, TimeCondition } from '../conditions'
import type { CueRegistry, HandlerId, ScenarioOf } from '../handler/registry'

/** State of a single handler */
export interface ApiSetting {
  enabled: boolean
  /** Selected scenario of a scenario handler. The first one if absent */
  scenario?: string
}

/**
 * The entire state cuesheet controls. Every control surface (UI, URL, programmatic API) converges on this one object.
 *
 * Per-handler state is kept apart from the global conditions, so handler ids never collide with reserved keys.
 */
export interface CueState {
  enabled: boolean
  api: Record<string, ApiSetting>
  delay: DelayCondition
  /** When null, the real time is used */
  time: TimeCondition | null
  network: NetworkCondition
}

/** One handler's part of a patch */
export interface ApiSettingPatch<Scenario extends string = string> {
  enabled?: boolean
  /** `undefined` goes back to the first scenario */
  scenario?: Scenario | undefined
}

/** `patch()`'s `api`: keyed by handler id, each typed with its own scenarios once the registry is filled */
export type ApiPatch = [keyof CueRegistry] extends [never]
  ? Record<string, ApiSettingPatch>
  : { [Id in HandlerId]?: ApiSettingPatch<ScenarioOf<Id>> }

/**
 * What `patch()` takes. Every level is optional and merged into the current state: a handler entry keeps the
 * fields you leave out, so `{ api: { getCoupons: { enabled: false } } }` keeps its selected scenario.
 * Pass `scenario: undefined` to go back to the first scenario
 */
export interface CuePatch {
  enabled?: boolean
  /**
   * Per-handler changes. With a `CueRegistry` declared, ids and each handler's scenario names are
   * checked like `select()`'s. For an id known only at runtime (a custom UI), cast: `{ [id]: { scenario } } as
   * ApiPatch` — an unknown name is then ignored with a console warning
   */
  api?: ApiPatch
  delay?: Partial<DelayCondition>
  time?: TimeCondition | null
  network?: Partial<NetworkCondition>
}

export {
  type CueStorage,
  createMemoryStorage,
  resolveStorage,
  STATE_KEY,
} from './storage'
export { createDefaultState, createStateStore, normalizeState, type StateStore } from './store'
