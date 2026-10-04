import { installClock, type UninstallClock } from './conditions/clock'
import { DEFAULT_GLOBAL_KEY, exposeGlobal } from './expose'
import {
  assertSelectable,
  assertValidHandlers,
  type CueEntry,
  type CueHandler,
  isScenarioHandler,
  type SelectArgs,
  toCatalog,
} from './handler'
import { renderHelp } from './help'
import {
  type CueRecord,
  createRecorder,
  type RecorderOptions,
  type RecordMatcher,
  type WaitOptions,
} from './record'
import { createResolver } from './resolver'
import {
  type ApiSettingPatch,
  type CuePatch,
  type CueState,
  type CueStorage,
  createDefaultState,
  createStateStore,
  resolveStorage,
} from './state'
import { type CuePlugin, createTransport, httpLogger } from './transport'
import { applyCueParam, consumeCueParamFromUrl, toCueParam, withCueParam } from './url'
import { isClient, isNil } from './util/guards'
import * as logger from './util/log'

/**
 * The instance currently intercepting, shared by every copy of this package on the page. fetch / XHR can only be
 * patched once — a second interceptor reuses the running one and its listeners never get attached — so a
 * second start() hands interception over instead. That happens when app code creates more than one instance
 * (Storybook, tests, micro-frontends); without it the new one would look started while the old one kept answering.
 * `stop` is what the next instance calls to take over. 1.0.1 kept the instance itself here, which also has a `stop`
 */
const RUNNING = Symbol.for('cuesheet.running')

type RunningSlot = { [RUNNING]?: { owner?: Cuesheet; stop(): void } }

export interface CuesheetOptions {
  /** The API definitions the app registers */
  handlers: CueHandler[]
  /** Base URL of the API the app calls. Handlers are defined with relative paths */
  baseUrl?: string | undefined
  /**
   * Where state is persisted. `localStorage` and `sessionStorage` fit as they are, and so does your own
   * store — both methods may return a promise, so IndexedDB, a database or an API works too.
   * If omitted, state is kept in memory only (SSR, tests)
   */
  storage?: CueStorage | undefined
  /** Whether cuesheet is enabled when there is no saved state. **Deciding the environment is up to the app** */
  defaultEnabled: boolean
  /** Whether to log intercepted requests to the console. Defaults to true */
  log?: boolean | undefined
  /** Plugins to insert into the request pipeline */
  plugins?: CuePlugin[] | undefined
  /**
   * Whether to install a control handle on the browser global. Defaults to `true` — lets external
   * drivers such as Playwright control cuesheet without going through the app bundle. Pass a string to install it under that name
   */
  expose?: boolean | string | undefined
  /** Whether to record intercepted requests. Defaults to `true`. Pass an object to set how many to keep and whether to include bodies */
  record?: boolean | RecorderOptions | undefined
}

// This must live in the same file as the public type (`Cuesheet`) to survive the d.ts bundle — in a separate
// file it gets dropped by the build and `window.__cuesheet__` loses its type for package consumers
declare global {
  interface Window {
    /** Control handle installed by the `expose` option. For external drivers such as Playwright */
    __cuesheet__?: Cuesheet
  }
}

export interface Cuesheet {
  /**
   * Starts intercepting fetch / XHR and applying the time condition. Calling it more than once has no extra effect.
   * Does nothing outside the browser — patching the server's fetch and Date during SSR would affect every request it serves.
   * Only one instance intercepts at a time: starting one stops whichever other instance is running
   */
  start(): void
  /** Stops intercepting and restores the original fetch / XHR / Date */
  stop(): void
  /** Applies the URL's `?cue=` to the state and removes it from the URL. Call before start() */
  applyUrlParams(): void
  getState(): CueState
  /**
   * Changes only the parts you pass. Every level is merged: a handler entry keeps the fields you leave out
   * (so turning a handler off and on keeps its scenario), and `delay` / `network` keep the fields you leave out
   */
  patch(partial: CuePatch): void
  /**
   * Selects a scenario for one handler and turns that handler on. The most common operation for both people and agents.
   * For an unknown id or scenario it **throws, listing the values you can choose from**.
   * It doesn't turn cuesheet itself on; while it's off, this warns and the selection applies once it's turned on
   */
  select(...args: SelectArgs): void
  /** Restores the default state */
  reset(): void
  /**
   * Replaces the whole handler list. Used to apply mock file edits without a reload (HMR).
   * Selected scenarios are kept by id. A scenario that no longer exists is deselected and falls back to the first one,
   * and the state of removed handlers is dropped. Subscribers are notified, so the UI re-renders with the new responses
   */
  replaceHandlers(handlers: CueHandler[]): void
  /** Called whenever the state changes. Returns an unsubscribe function */
  subscribe(listener: (state: CueState) => void): () => void
  /** What can be controlled. Used for rendering the UI and for agent discovery. Sorted by API path */
  getCatalog(): Record<string, CueEntry>
  /** Serializes the current state as a `?cue=` value */
  toShareParam(): string
  /** An absolute URL carrying the current state, for sharing */
  toShareUrl(): string
  /** Records of requests cuesheet answered, filtered by the matcher if given */
  getRecords(matcher?: RecordMatcher): CueRecord[]
  clearRecords(): void
  /** Waits for a matching request to arrive **from now on**. Use `getRecords()` for past ones */
  waitForRequest(matcher?: RecordMatcher, options?: WaitOptions): Promise<CueRecord>
  /** Called whenever a record is added. Returns an unsubscribe function */
  subscribeRecords(listener: (records: CueRecord[]) => void): () => void
  /**
   * A plain-text cheat sheet with the live handlers and state. For agents that find
   * `window.__cuesheet__` without any other context
   */
  help(): string
  /**
   * The store this instance persists to — the one passed in `storage`, or memory. Anything else that has to
   * remember something (the panel's open state) writes here too, so swapping the store is done in one place
   */
  readonly storage: CueStorage
}

function hasScenario(meta: CueHandler, scenario: string): boolean {
  return isScenarioHandler(meta.handler) && meta.handler.some((candidate) => candidate.scenario === scenario)
}

/*
 * patch() helpers. Whatever patch() can't use is ignored with a warning and the rest still applies, so one stale
 * or mistyped value doesn't throw away the whole patch. select() is the call that throws on a typo
 */

function patchApi(
  current: CueState['api'],
  change: CuePatch['api'],
  handlers: CueHandler[],
): CueState['api'] {
  const api = { ...current }
  for (const [id, value] of Object.entries(change ?? {}) as [string, unknown][]) {
    const meta = handlers.find((candidate) => candidate.id === id)
    if (isNil(meta)) {
      const ids = handlers.map((candidate) => candidate.id).join(', ')
      logger.warn(`patch(): no handler named '${id}'; ignored. Available: ${ids}`)
      continue
    }
    if (typeof value !== 'object' || isNil(value)) {
      logger.warn(`patch(): '${id}' must be an object like { enabled, scenario }; ignored.`)
      continue
    }
    let setting = value as ApiSettingPatch
    // Dropped rather than carried into the state: `normalizeState` can only read a non-boolean as `true`,
    // so `{ enabled: 'false' }` would turn the handler **on** — the opposite of what was asked for
    if (setting.enabled !== undefined && typeof setting.enabled !== 'boolean') {
      logger.warn(
        `patch(): '${id}'.enabled takes true or false, got ${JSON.stringify(setting.enabled)}; ignored.`,
      )
      const { enabled: _ignored, ...rest } = setting
      setting = rest
    }
    if (setting.scenario !== undefined && !hasScenario(meta, setting.scenario)) {
      const names = isScenarioHandler(meta.handler)
        ? `Available: ${meta.handler.map((candidate) => candidate.scenario).join(', ')}`
        : 'It has no scenarios.'
      logger.warn(`patch(): handler '${id}' has no scenario '${setting.scenario}'; ignored. ${names}`)
      const { scenario: _ignored, ...rest } = setting
      setting = rest
    }
    const merged = { ...api[id], ...setting }
    // `scenario: undefined` deselects, so it falls back to the first scenario
    api[id] =
      merged.scenario === undefined
        ? { enabled: merged.enabled ?? true }
        : { enabled: merged.enabled ?? true, scenario: merged.scenario }
  }
  return api
}

function isMs(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function patchDelay(current: CueState['delay'], change: CuePatch['delay']): CueState['delay'] {
  if (isNil(change)) {
    return current
  }
  if ((change.min !== undefined && !isMs(change.min)) || (change.max !== undefined && !isMs(change.max))) {
    logger.warn(`patch(): delay takes milliseconds of 0 or more, got ${JSON.stringify(change)}; ignored.`)
    return current
  }
  return { ...current, ...change }
}

/**
 * The master switch. A value that isn't a boolean would otherwise reach `normalizeState`, which can only
 * fall back to `defaultEnabled` — turning cuesheet off (or on) behind the back of a caller who asked for
 * neither. Untyped callers are the normal case here: a console, an agent, a Playwright `evaluate`
 */
function patchEnabled(current: boolean, change: CuePatch['enabled']): boolean {
  if (change === undefined) {
    return current
  }
  if (typeof change !== 'boolean') {
    logger.warn(`patch(): enabled takes true or false, got ${JSON.stringify(change)}; ignored.`)
    return current
  }
  return change
}

function patchNetwork(current: CueState['network'], change: CuePatch['network']): CueState['network'] {
  if (isNil(change)) {
    return current
  }
  if (change.offline !== undefined && typeof change.offline !== 'boolean') {
    logger.warn(`patch(): network.offline takes true or false, got ${JSON.stringify(change)}; ignored.`)
    return current
  }
  return { ...current, ...change }
}

function patchTime(current: CueState['time'], change: CuePatch['time']): CueState['time'] {
  if (change === undefined) {
    return current
  }
  if (
    change !== null &&
    (typeof change.now !== 'string' ||
      Number.isNaN(Date.parse(change.now)) ||
      (change.mode !== 'frozen' && change.mode !== 'running'))
  ) {
    logger.warn(
      `patch(): time takes { now: an ISO date, mode: 'frozen' | 'running' } or null, got ${JSON.stringify(change)}; ignored.`,
    )
    return current
  }
  return change
}

export function createCuesheet({
  handlers: initialHandlers,
  baseUrl,
  storage,
  defaultEnabled,
  log = true,
  plugins = [],
  expose = true,
  record = true,
}: CuesheetOptions): Cuesheet {
  assertValidHandlers(initialHandlers)
  let handlers = initialHandlers
  const getHandlers = (): CueHandler[] => handlers

  // Resolved once and shared: the state store and anything else that persists something use the same object
  const store = resolveStorage(storage)
  const state = createStateStore({ getHandlers, defaultEnabled, storage: store })
  const resolve = createResolver({ getHandlers, state, baseUrl })
  // `record: false` keeps nothing and reads no bodies, but waitForRequest() and subscribeRecords() still work
  const recorder = createRecorder(
    record === false ? { limit: 0, bodies: false } : typeof record === 'object' ? record : {},
  )
  const transport = createTransport({
    resolve,
    plugins: [recorder.plugin, ...(log ? [httpLogger] : []), ...plugins],
  })

  let started = false
  /** Set when another instance took over, until this one starts again. Its state is no longer what answers */
  let supplanted = false
  let uninstallClock: UninstallClock | undefined
  let appliedTime: string | undefined

  /** Applies the state's time condition to the real clock. Does nothing if it hasn't changed. Turning cuesheet off restores the real clock */
  function syncClock(): void {
    const { enabled, time: condition } = state.get()
    const time = enabled ? condition : null
    const next = isNil(time) ? undefined : `${time.now}|${time.mode}`
    if (next === appliedTime) {
      return
    }
    uninstallClock?.()
    uninstallClock = isNil(time) ? undefined : installClock(time)
    appliedTime = next
  }

  state.subscribe(() => {
    if (started) {
      syncClock()
    }
  })

  /**
   * Whether this instance may change the state. One another instance took over still shares the storage key,
   * so a change made through its panel would answer nothing now and still be what the next load restores
   */
  function writable(method: string): boolean {
    if (supplanted) {
      logger.warn(
        `${method}(): another cuesheet instance took over from this one, so it was ignored. Use the running instance, or start() this one again.`,
      )
    }
    return !supplanted
  }

  const cuesheet: Cuesheet = {
    start() {
      if (started) {
        return
      }
      if (!isClient()) {
        logger.warn('start() was called outside the browser; not intercepting. Start it on the client only.')
        return
      }
      const slot = globalThis as RunningSlot
      const running = slot[RUNNING]
      if (!isNil(running) && running.owner !== cuesheet) {
        running.stop()
        if (log) {
          logger.info('Another cuesheet instance was running; stopped it and took over')
        }
      }
      slot[RUNNING] = {
        owner: cuesheet,
        stop() {
          cuesheet.stop()
          supplanted = true
        },
      }
      supplanted = false
      // Exposed at creation, but the handle must follow whichever instance answers: after a.start(),
      // b.start(), a.start() it would otherwise still be b, and a test driving it would change nothing
      if (expose !== false) {
        exposeGlobal(cuesheet, typeof expose === 'string' ? expose : DEFAULT_GLOBAL_KEY)
      }
      started = true
      syncClock()
      transport.start()
      // One line an agent reading the console can't miss, pointing at the way in
      if (log && isClient()) {
        const handle = expose === false ? undefined : typeof expose === 'string' ? expose : DEFAULT_GLOBAL_KEY
        const mode = state.get().enabled ? 'on' : 'off'
        const count = `${handlers.length} handler${handlers.length === 1 ? '' : 's'}`
        logger.info(
          handle === undefined
            ? `${mode} with ${count}`
            : `${mode} with ${count}. Run window.${handle}.help() to see how to drive it`,
        )
      }
    },

    stop() {
      const slot = globalThis as RunningSlot
      if (slot[RUNNING]?.owner === cuesheet) {
        delete slot[RUNNING]
      }
      started = false
      transport.stop()
      uninstallClock?.()
      uninstallClock = undefined
      appliedTime = undefined
    },

    applyUrlParams() {
      if (!writable('applyUrlParams')) {
        return
      }
      const raw = consumeCueParamFromUrl()
      if (isNil(raw)) {
        return
      }
      // undefined when the value says nothing cuesheet understands. Leaving the state alone then, rather than
      // writing the defaults, keeps a stray `?cue=...` from turning mocking on and saving that
      const next = applyCueParam(raw, handlers)
      if (!isNil(next)) {
        state.set(next)
      }
    },

    getState: state.get,

    patch(partial) {
      if (!writable('patch')) {
        return
      }
      // The typed signature requires the object, but the callers that matter here are untyped: a console,
      // an agent, a Playwright `evaluate`. A library warning beats a TypeError from inside the library
      if (typeof partial !== 'object' || isNil(partial)) {
        logger.warn(
          `patch() takes an object like { enabled, api, delay, time, network }, got ${JSON.stringify(partial)}; ignored.`,
        )
        return
      }
      const current = state.get()
      state.set({
        enabled: patchEnabled(current.enabled, partial.enabled),
        api: patchApi(current.api, partial.api, handlers),
        delay: patchDelay(current.delay, partial.delay),
        time: patchTime(current.time, partial.time),
        network: patchNetwork(current.network, partial.network),
      })
    },

    select(...[id, scenario]) {
      if (!writable('select')) {
        return
      }
      assertSelectable(handlers, id, scenario)
      const current = state.get()
      if (!current.enabled) {
        logger.warn(
          `Selected '${scenario}' for '${id}', but cuesheet is off, so requests still go to the real server. Turn it on with patch({ enabled: true }).`,
        )
      }
      state.set({
        ...current,
        api: { ...current.api, [id]: { enabled: true, scenario } },
      })
    },

    reset() {
      if (!writable('reset')) {
        return
      }
      state.set(createDefaultState(handlers, defaultEnabled))
    },

    replaceHandlers(next) {
      assertValidHandlers(next)
      handlers = next
      // Not set(): a set counts as a change by the app, and would throw away a still-pending read from an
      // async store. Nothing here was chosen by anyone — the state is only being read against new handlers
      state.renormalize()
    },

    subscribe: state.subscribe,
    storage: store,
    getCatalog: () => toCatalog(handlers),
    toShareParam: () => toCueParam(state.get(), handlers),

    getRecords: recorder.getRecords,
    clearRecords: recorder.clear,
    waitForRequest: recorder.waitFor,
    subscribeRecords: recorder.subscribe,
    help: () =>
      renderHelp(
        toCatalog(handlers),
        state.get(),
        toCueParam(state.get(), handlers),
        expose === false ? 'cuesheet' : `window.${typeof expose === 'string' ? expose : DEFAULT_GLOBAL_KEY}`,
      ),

    toShareUrl() {
      const param = toCueParam(state.get(), handlers)
      const href = isClient() ? window.location.href : 'http://localhost/'
      return withCueParam(href, param)
    },
  }

  if (expose !== false) {
    exposeGlobal(cuesheet, typeof expose === 'string' ? expose : DEFAULT_GLOBAL_KEY)
  }
  return cuesheet
}
