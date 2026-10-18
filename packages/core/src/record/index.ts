import type { HandlerId, ScenarioName, ScenarioOf } from '../handler'
import type { CuePlugin } from '../transport'
import { discardBody, readBody, readResponseBody } from '../util/body'
import { isNil } from '../util/guards'
import * as log from '../util/log'
import { pathOf } from '../util/path'

/** Record of a single request cuesheet answered */
export interface CueRecord {
  requestId: string
  method: string
  /** Full request URL */
  url: string
  /** Path + query, without the origin */
  path: string
  /** id of the handler that responded */
  handlerId?: string
  /** The scenario that answered (the first one if none was selected). Absent for single-response handlers */
  scenario?: string
  /** Response status. 0 if the request failed */
  status: number
  /** Reason for failure, if it failed (offline, etc.) */
  error?: string
  /** Time from interception to response (including delay) */
  durationMs: number
  /** When the request was intercepted. A monotonic performance.now value, so unaffected by the time condition */
  startedAt: number
  requestBody?: unknown
  responseBody?: unknown
}

interface MatcherFields {
  method?: string | undefined
  /** Path. A string matches as a substring; a RegExp is tested */
  path?: string | RegExp | undefined
  status?: number | undefined
  /** true for failed requests only, false for successful ones only */
  failed?: boolean | undefined
}

/**
 * Conditions for picking records. Only the fields you set are compared. With the generated types, a
 * `handlerId` narrows `scenario` to that handler's own scenarios, as `select()` does
 */
export type RecordMatcher = MatcherFields &
  (
    | {
        handlerId?: undefined
        /** The scenario that answered, of any handler */
        scenario?: ScenarioName | undefined
      }
    | {
        [Id in HandlerId]: {
          /** Handler id — the same name as `CueRecord.handlerId` */
          handlerId: Id
          /** The scenario that answered */
          scenario?: ScenarioOf<Id> | undefined
        }
      }[HandlerId]
  )

export interface RecorderOptions {
  /** Maximum number of records to keep. The oldest are dropped first. Defaults to 100. 0 keeps none */
  limit?: number | undefined
  /** Whether to also keep request and response bodies. Defaults to true */
  bodies?: boolean | undefined
}

/** The longest waitForRequest() will wait. Anything longer — `Infinity` included — is cut down to this */
export const MAX_WAIT_TIMEOUT = 60_000

export interface WaitOptions {
  /** Maximum time to wait (ms). Defaults to 5000, capped at 60000 */
  timeout?: number | undefined
}

export interface Recorder {
  /** Plugin to insert into the transport */
  plugin: CuePlugin
  getRecords(matcher?: RecordMatcher): CueRecord[]
  clear(): void
  waitFor(matcher?: RecordMatcher, options?: WaitOptions): Promise<CueRecord>
  subscribe(listener: (records: CueRecord[]) => void): () => void
}

const MATCHER_KEYS = ['handlerId', 'scenario', 'method', 'path', 'status', 'failed']

/**
 * Throws on a key a matcher doesn't have. An unknown key would be ignored, matching every record — easy to do
 * from untyped code, e.g. `{ id: 'getCoupons' }`
 */
export function assertMatcher(matcher: RecordMatcher): void {
  const unknown = Object.keys(matcher).filter((key) => !MATCHER_KEYS.includes(key))
  if (unknown.length > 0) {
    const hint = unknown.includes('id') ? " Use 'handlerId' for the handler id." : ''
    throw new Error(
      log.message(
        `Unknown record matcher key: ${unknown.join(', ')}. Use ${MATCHER_KEYS.join(', ')}.${hint}`,
      ),
    )
  }
}

export function matches(record: CueRecord, matcher: RecordMatcher): boolean {
  if (matcher.handlerId !== undefined && record.handlerId !== matcher.handlerId) {
    return false
  }
  if (matcher.scenario !== undefined && record.scenario !== matcher.scenario) {
    return false
  }
  if (matcher.method !== undefined && record.method.toUpperCase() !== matcher.method.toUpperCase()) {
    return false
  }
  if (matcher.status !== undefined && record.status !== matcher.status) {
    return false
  }
  if (matcher.failed !== undefined && matcher.failed !== (record.error !== undefined)) {
    return false
  }
  if (typeof matcher.path === 'string' && !record.path.includes(matcher.path)) {
    return false
  }
  if (matcher.path instanceof RegExp) {
    // With the g or y flag, test() advances lastIndex and would miss the next record, so rewind it every time
    matcher.path.lastIndex = 0
    if (!matcher.path.test(record.path)) {
      return false
    }
  }
  return true
}

function describe(matcher: RecordMatcher): string {
  const parts = Object.entries(matcher).map(([key, value]) => `${key}=${String(value)}`)
  return parts.length > 0 ? parts.join(' ') : '(no conditions)'
}

/**
 * Records requests cuesheet answered. People see them in the panel; agents read them with
 * `getRecords()` or wait for them with `waitFor()`.
 */
/**
 * The timeout waitForRequest() actually uses. setTimeout reads anything past 2^31 - 1 ms, Infinity included,
 * as 1 ms, so "wait with no limit" used to reject at once: it is capped instead. Anything that isn't a
 * number of 0 or more (`null`, `'5s'`, `-1`, NaN) falls back to the default, with a warning either way
 */
function waitTime(timeout: unknown): number {
  if (typeof timeout !== 'number' || !(timeout >= 0)) {
    log.warn(
      `waitForRequest(): timeout takes milliseconds of 0 or more, got ${String(timeout)}; waiting 5000ms.`,
    )
    return 5000
  }
  if (timeout > MAX_WAIT_TIMEOUT) {
    log.warn(
      `waitForRequest(): timeout is capped at ${MAX_WAIT_TIMEOUT}ms, got ${timeout}; waiting ${MAX_WAIT_TIMEOUT}ms.`,
    )
    return MAX_WAIT_TIMEOUT
  }
  return timeout
}

export function createRecorder({ limit = 100, bodies = true }: RecorderOptions = {}): Recorder {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(log.message(`record.limit must be a whole number of 0 or more, got ${String(limit)}.`))
  }
  let records: CueRecord[] = []
  /**
   * Interception order. A record is pushed only once its bodies are read, so an earlier request can land after
   * a later one; `waitFor()` has to tell "arrived from now on" apart from "was already in flight". A timestamp
   * can't: browsers round `performance.now()` (to 100µs, coarser with the clock blurred for Spectre), so a
   * request intercepted just before the call reads back as exactly the call's own time
   */
  let intercepted = 0
  const order = new WeakMap<CueRecord, number>()
  const waiters = new Set<{
    matcher: RecordMatcher
    /** The first interception that counts: everything in flight when waiting began is older than this */
    since: number
    resolve: (record: CueRecord) => void
  }>()
  const listeners = new Set<(records: CueRecord[]) => void>()

  function push(record: CueRecord): void {
    // slice(-0) would keep everything, so 0 is handled on its own
    records = limit === 0 ? [] : [...records, record].slice(-limit)

    for (const waiter of [...waiters]) {
      // A record with no sequence can't have one attributed to it, so it counts as having just arrived —
      // resolving one waiter too many beats hanging until the timeout
      if (
        (order.get(record) ?? Number.POSITIVE_INFINITY) >= waiter.since &&
        matches(record, waiter.matcher)
      ) {
        waiters.delete(waiter)
        waiter.resolve(record)
      }
    }
    for (const listener of listeners) {
      try {
        listener(records)
      } catch (cause) {
        log.error('A record subscriber threw', cause)
      }
    }
  }

  /** The part shared by responses and failures. `carried` is the sequence number `onRequest` handed out */
  function baseRecord(
    context: Parameters<NonNullable<CuePlugin['onResponse']>>[0],
    carried: unknown,
  ): CueRecord {
    const { meta } = context
    const record: CueRecord = {
      requestId: context.requestId,
      method: context.request.method,
      url: context.request.url,
      path: pathOf(context.request.url),
      status: 0,
      durationMs: Math.round(performance.now() - context.startedAt),
      startedAt: context.startedAt,
    }
    if (!isNil(meta)) {
      record.handlerId = meta.handlerId
      if (meta.scenario !== undefined) {
        record.scenario = meta.scenario
      }
    }
    if (typeof carried === 'number') {
      order.set(record, carried)
    }
    return record
  }

  // Bodies are read only for requests cuesheet answered — never for ones going to the real network
  const plugin: CuePlugin = {
    // Runs for every intercepted request, in the order they were intercepted — before any body is read
    onRequest() {
      intercepted += 1
      return intercepted
    },

    async onError(context, error, carried) {
      const record = baseRecord(context, carried)
      record.error = error.message
      if (bodies) {
        const requestBody = await readBody(context.request.clone())
        if (requestBody !== undefined) {
          record.requestBody = requestBody
        }
      }
      push(record)
    },

    async onResponse(context, response, carried) {
      const record = baseRecord(context, carried)
      record.status = response.status
      // A scenario returning `HttpResponse.error()` fails the app's fetch the way a dropped connection does,
      // but it arrives here as a response — with status 0 and no failure noted, `failed: true` would miss it
      if (response.type === 'error') {
        record.error = 'Network error'
      }
      if (bodies) {
        const [requestBody, responseBody] = await Promise.all([
          readBody(context.request.clone()),
          readResponseBody(response),
        ])
        if (requestBody !== undefined) {
          record.requestBody = requestBody
        }
        if (responseBody !== undefined) {
          record.responseBody = responseBody
        }
      } else {
        discardBody(response)
      }
      push(record)
    },
  }

  return {
    plugin,

    getRecords(matcher) {
      if (!isNil(matcher)) {
        assertMatcher(matcher)
      }
      return isNil(matcher) ? [...records] : records.filter((record) => matches(record, matcher))
    },

    clear() {
      records = []
      // Isolated like push(), so one throwing subscriber doesn't hide the clear from the others
      for (const listener of listeners) {
        try {
          listener(records)
        } catch (cause) {
          log.error('A record subscriber threw', cause)
        }
      }
    },

    /**
     * Waits for a matching request to arrive **from now on**. Existing records are ignored, so
     * "was this API called after clicking the button?" can be checked without flakiness.
     * Use `getRecords(matcher)` to find past ones.
     */
    waitFor(matcher = {}, options = {}) {
      // An untyped `null` (a driver's page.evaluate, the console) skips the parameter default, so it is caught
      // here. `{ timeout: null }` still reaches waitTime(), which warns about it
      const { timeout = 5000 } = options ?? {}
      // Checked before the promise exists, so a mistyped key throws where it was written, as getRecords() does.
      // Inside the executor it would only reject — and go unnoticed until someone awaits it
      assertMatcher(matcher)
      const wait = waitTime(timeout)
      return new Promise<CueRecord>((resolve, reject) => {
        const waiter = {
          matcher,
          // The next request to be intercepted, so anything already in flight can't resolve this
          since: intercepted + 1,
          resolve: (record: CueRecord) => {
            clearTimeout(timer)
            resolve(record)
          },
        }
        const timer = setTimeout(() => {
          waiters.delete(waiter)
          reject(new Error(log.message(`No ${describe(matcher)} request arrived within ${wait}ms.`)))
        }, wait)
        waiters.add(waiter)
      })
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
