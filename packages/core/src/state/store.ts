import { type CueHandler, isScenarioHandler } from '../handler'
import { isNil } from '../util/guards'
import * as log from '../util/log'
import type { ApiSetting, CueState } from './index'
import { type CueStorage, isPromise, resolveStorage, STATE_KEY } from './storage'

export interface StateStore {
  /** The current state. The same object until the state or the handler list changes */
  get(): CueState
  set(state: CueState): void
  /**
   * Re-reads the state against the current handler list and notifies, without counting as a change:
   * nothing is written and a pending read from an async store still wins. For HMR, where the handlers
   * were replaced but nobody chose anything
   */
  renormalize(): void
  /** Called whenever the state changes. Returns an unsubscribe function */
  subscribe(listener: (state: CueState) => void): () => void
}

interface StateStoreOptions {
  /** Handlers can change at runtime (HMR), so this takes a getter instead of a value */
  getHandlers(): CueHandler[]
  defaultEnabled: boolean
  storage?: CueStorage | undefined
}

/**
 * Default state. Every handler starts on — whether cuesheet answers at all is decided by the master switch
 * (`enabled`) alone, so turning it on from the panel, `?cue=` or `patch()` all mean the same thing
 */
export function createDefaultState(handlers: CueHandler[], enabled: boolean): CueState {
  return {
    enabled,
    api: Object.fromEntries(handlers.map(({ id }) => [id, { enabled: true }])),
    delay: { min: 0, max: 0 },
    time: null,
    network: { offline: false },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && !isNil(value) && !Array.isArray(value)
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Turns any value into a valid state for the current handler list. Each field that is missing or malformed
 * falls back to its default on its own, so one bad field (an old schema, a hand-edited value) doesn't throw
 * away the rest, and a bad value can never reach the resolver or the panel.
 *
 * Handlers can change through HMR or a reload after editing a mock file, so entries for removed handlers are
 * dropped and removed scenarios are deselected (falling back to the first one). Without this, the response
 * would come from the first scenario while the state, panel and share links still point at the removed one
 */
export function normalizeState(value: unknown, handlers: CueHandler[], defaultEnabled: boolean): CueState {
  const defaults = createDefaultState(handlers, defaultEnabled)
  if (!isRecord(value)) {
    return defaults
  }

  const storedApi = isRecord(value.api) ? value.api : {}
  const api: Record<string, ApiSetting> = {}
  for (const meta of handlers) {
    const setting = isRecord(storedApi[meta.id]) ? (storedApi[meta.id] as Record<string, unknown>) : {}
    const enabled = typeof setting.enabled === 'boolean' ? setting.enabled : true
    const { scenario } = setting
    const known =
      typeof scenario === 'string' &&
      isScenarioHandler(meta.handler) &&
      meta.handler.some((candidate) => candidate.scenario === scenario)
    api[meta.id] = known ? { enabled, scenario } : { enabled }
  }

  const { delay, time, network } = value
  const state: CueState = {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    api,
    delay: defaults.delay,
    time: null,
    network: defaults.network,
  }
  if (isRecord(delay)) {
    // Whole milliseconds, like a ?cue= link carries — so every state can be shared and reopened as it is
    const min = isDuration(delay.min) ? Math.round(delay.min) : defaults.delay.min
    const max = isDuration(delay.max) ? Math.round(delay.max) : min
    state.delay = { min, max: Math.max(min, max) }
  }
  if (
    isRecord(time) &&
    typeof time.now === 'string' &&
    !Number.isNaN(Date.parse(time.now)) &&
    (time.mode === 'frozen' || time.mode === 'running')
  ) {
    // Stored as ISO: a looser form that Date.parse accepts ('2026-01-31 09:00') may not survive a ?cue= link
    state.time = { now: new Date(Date.parse(time.now)).toISOString(), mode: time.mode }
  }
  if (isRecord(network) && typeof network.offline === 'boolean') {
    state.network = { offline: network.offline }
  }
  return state
}

/**
 * The state lives in memory; storage is only written through so it survives a reload. If a write fails
 * (private mode, quota, a sandboxed iframe) requests, the panel and the clock still agree, because they all
 * read the same in-memory state. Each tab keeps its own state — what's in storage when a tab loads wins.
 *
 * A store that answers asynchronously (IndexedDB, a database, an API) can't be read before the app boots, so
 * state starts from the defaults and the stored one is applied — and subscribers notified — once it arrives.
 * Anything that changed the state in the meantime wins, so a `?cue=` link is never overwritten by a late read
 */
export function createStateStore({
  getHandlers,
  defaultEnabled,
  storage = resolveStorage(undefined),
}: StateStoreOptions): StateStore {
  const listeners = new Set<(state: CueState) => void>()

  function parse(raw: string | null): unknown {
    try {
      return isNil(raw) ? undefined : JSON.parse(raw)
    } catch (cause) {
      log.error('Failed to read state; using defaults', cause)
      return undefined
    }
  }

  function notify(): void {
    for (const listener of listeners) {
      try {
        listener(current)
      } catch (cause) {
        log.error('A subscriber threw', cause)
      }
    }
  }

  let handlers = getHandlers()
  /** Whether anything has set the state since boot. A late read from an async store must not undo it */
  let touched = false
  let current = normalizeState(undefined, handlers, defaultEnabled)

  function load(): void {
    let raw: string | null | Promise<string | null>
    try {
      raw = storage.getItem(STATE_KEY)
    } catch (cause) {
      log.error('Failed to read state; using defaults', cause)
      return
    }
    if (!isPromise(raw)) {
      current = normalizeState(parse(raw), handlers, defaultEnabled)
      return
    }
    void raw
      .then((value) => {
        if (touched) {
          return
        }
        current = normalizeState(parse(value), getHandlers(), defaultEnabled)
        notify()
      })
      .catch((cause: unknown) => {
        log.error('Failed to read state; using defaults', cause)
      })
  }
  load()

  function get(): CueState {
    const latest = getHandlers()
    if (latest !== handlers) {
      handlers = latest
      current = normalizeState(current, handlers, defaultEnabled)
    }
    return current
  }

  /** The write in flight, while the store answers asynchronously. `undefined` for a store that answers at once */
  let writing: Promise<void> | undefined
  /** The newest value waiting for that write to finish. Only the last one is worth writing */
  let queued: string | undefined

  /** One write. Returns a promise for an async store, `undefined` for a sync one, and never rejects */
  function write(value: string): Promise<void> | undefined {
    try {
      const written = storage.setItem(STATE_KEY, value)
      if (!isPromise(written)) {
        return undefined
      }
      return written.catch((cause: unknown) => {
        log.error('Failed to save state; it applies until the page reloads', cause)
      })
    } catch (cause) {
      log.error('Failed to save state; it applies until the page reloads', cause)
      return undefined
    }
  }

  /**
   * Saves the state, one write at a time.
   *
   * A store that answers asynchronously (IndexedDB, a database, an API) can finish two writes in either
   * order, so two quick changes could leave the older one in storage and the newer one only in memory —
   * the next reload would then undo what was done last. Writes are chained instead, and a value that a
   * newer one replaced while waiting is dropped rather than written on its way out.
   */
  function save(value: string): void {
    if (writing !== undefined) {
      queued = value
      return
    }
    const started = write(value)
    if (started === undefined) {
      return
    }
    writing = started.then(function next(): void | Promise<void> {
      if (queued === undefined) {
        writing = undefined
        return
      }
      const pending = queued
      queued = undefined
      const again = write(pending)
      if (again === undefined) {
        writing = undefined
        return
      }
      return again.then(next)
    })
  }

  function set(next: CueState): void {
    handlers = getHandlers()
    touched = true
    current = normalizeState(next, handlers, defaultEnabled)
    save(JSON.stringify(current))
    notify()
  }

  function renormalize(): void {
    handlers = getHandlers()
    current = normalizeState(current, handlers, defaultEnabled)
    notify()
  }

  function subscribe(listener: (state: CueState) => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return { get, set, renormalize, subscribe }
}
