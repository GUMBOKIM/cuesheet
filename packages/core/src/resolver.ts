import { getResponse, type HttpHandler } from 'msw'
import { type CueHandler, effectiveScenario, selectHandler } from './handler'
import type { StateStore } from './state'
import type { CueResolution, CueResolutionMeta } from './transport'
import { isClient, isNil } from './util/guards'
import * as log from './util/log'

interface ResolverOptions {
  /** Read on every request, since handlers can change at runtime (HMR) */
  getHandlers(): CueHandler[]
  state: StateStore
  /** Base URL of the API the app calls. Handlers are defined with relative paths, so this is stripped before matching */
  baseUrl?: string | undefined
}

/** Whether the handler returned `passthrough()`. MSW signals a bypass with this special response */
function isPassthrough(response: Response): boolean {
  return response.status === 302 && response.headers.get('x-msw-intention') === 'passthrough'
}

/**
 * Whether the request goes to the base URL. A plain prefix check would also match
 * `https://api.example.com.evil.com`, so what follows the base must be the end or the start of a path, query or hash
 */
function isUnder(url: string, base: string): boolean {
  if (!url.startsWith(base)) {
    return false
  }
  const next = url.charAt(base.length)
  return next === '' || next === '/' || next === '?' || next === '#'
}

/**
 * The base URL as the absolute, normalized form `request.url` has, without a trailing slash. A relative base
 * (`/api`, common behind a dev proxy), an upper-case host or a default port would otherwise never match
 */
function normalizeBase(baseUrl: string | undefined): string | undefined {
  if (isNil(baseUrl)) {
    return undefined
  }
  try {
    return new URL(baseUrl, isClient() ? window.location.href : 'http://localhost/').href.replace(/\/+$/, '')
  } catch {
    throw new Error(log.message(`baseUrl '${baseUrl}' is not a URL or a path.`))
  }
}

/** Waits, but stops early if the request is aborted — an aborted request shouldn't hold a timer for the whole delay */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolveSleep) => {
    if (signal.aborted) {
      resolveSleep()
      return
    }
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolveSleep()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

/**
 * Rewrites a request to the base URL as an origin-relative request.
 *
 * Normalizing the request instead of registering every handler twice (relative and absolute)
 * means no handler duplication and no access to MSW's internal resolver.
 */
async function toOriginRelative(request: Request, base: string): Promise<Request> {
  const rest = request.url.slice(base.length)
  const origin = isClient() ? window.location.origin : 'http://localhost'
  const url = `${origin}${rest.startsWith('/') ? rest : `/${rest}`}`

  // Carry over what the handler or the interceptor may look at. `mode` is left out: 'navigate' can't be constructed
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    credentials: request.credentials,
    redirect: request.redirect,
    signal: request.signal,
  }
  // A body-less POST must stay body-less — an empty buffer would give the handler a (empty) stream
  if (request.body !== null) {
    init.body = await request.clone().arrayBuffer()
  }
  return new Request(url, init)
}

/**
 * Creates a function that reads the state and decides how to handle a single request.
 * State is re-read on every request, so setting changes take effect immediately.
 */
export function createResolver({
  getHandlers,
  state,
  baseUrl,
}: ResolverOptions): (request: Request, signal?: AbortSignal) => Promise<CueResolution | undefined> {
  const base = normalizeBase(baseUrl)

  return async function resolve(
    request: Request,
    signal: AbortSignal = request.signal,
  ): Promise<CueResolution | undefined> {
    const current = state.get()
    if (!current.enabled) {
      return undefined
    }

    /** The wait a mocked request goes through. `?cue=delay:800-2000` picks a new value each time */
    async function applyDelay(): Promise<void> {
      const { min, max } = current.delay
      if (max > 0) {
        // The transport sees the abort and fails the request instead of answering it
        await sleep(min + Math.floor(Math.random() * (max - min + 1)), signal)
      }
    }

    // Offline takes precedence over handler matching. With a base URL set, only requests to it are cut off
    const targetsApi = isNil(base) || isUnder(request.url, base)
    if (current.network.offline && targetsApi) {
      // Delayed like any other answer: a real connection fails after hanging, and a screen's loading state
      // is only visible if the failure takes a moment
      await applyDelay()
      return { error: new TypeError('Failed to fetch') }
    }

    const active = getHandlers()
      .filter((meta) => current.api[meta.id]?.enabled)
      .map((meta) => ({
        id: meta.id,
        // Recorded as the scenario that actually answered, so the default one is named too
        scenario: effectiveScenario(meta, current.api[meta.id]?.scenario),
        handler: selectHandler(meta, current.api[meta.id]?.scenario),
      }))
    if (active.length === 0) {
      return undefined
    }

    // The request as it was sent, plus — under a base URL — the same request with the base stripped, since
    // handlers are written with relative paths
    const candidates: Request[] = [request]
    if (!isNil(base) && isUnder(request.url, base)) {
      candidates.push(await toOriginRelative(request, base))
    }

    // Check handlers one at a time and use the first match. They aren't passed all at once
    // because we need to know which handler responded in order to record it.
    // A resolver returning undefined means no match, so we move on to the next handler.
    // A handler may read the body and then decline, so each gets a fresh clone — passing the
    // same Request would make the next handler fail with 'Body has already been used'.
    // Handlers are the outer loop, so declaration order decides — msw's rule, and the one the panel and
    // the docs describe. The other way round, a handler matching the request as sent (`http.all('*')`,
    // say) would answer ahead of one declared before it that only matches the relative form
    for (const entry of active) {
      for (const candidate of candidates) {
        const response = await matchOne(entry.handler, candidate.clone())
        if (isNil(response)) {
          continue
        }
        if (isPassthrough(response)) {
          return undefined
        }
        // Delay applies only to requests cuesheet decided to answer.
        // Bypassed requests already experience real network latency, so there's no reason to add more
        await applyDelay()
        const meta: CueResolutionMeta = { handlerId: entry.id }
        if (entry.scenario !== undefined) {
          meta.scenario = entry.scenario
        }
        return { response, meta }
      }
    }
    return undefined
  }
}

function matchOne(handler: HttpHandler, request: Request): Promise<Response | undefined> {
  return getResponse([handler], request)
}
