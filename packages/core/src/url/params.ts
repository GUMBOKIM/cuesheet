import type { CueHandler } from '../handler'
import { isScenarioHandler } from '../handler'
import { type CueState, createDefaultState } from '../state'
import { isClient, isNil } from '../util/guards'
import * as log from '../util/log'

import {
  CUE_PARAM,
  DELAY,
  DISABLE_PREFIX,
  ITEM_SEPARATOR,
  OFF,
  OFFLINE,
  ON,
  RUNNING_SUFFIX,
  TIME,
  VALUE_SEPARATOR,
} from './syntax'

export { CUE_PARAM }

function isCuePair(pair: string): boolean {
  const key = pair.split('=', 1)[0] ?? ''
  try {
    return decodeURIComponent(key.replaceAll('+', ' ')) === CUE_PARAM
  } catch {
    return false
  }
}

/**
 * Reads the `?cue=` value from the URL and removes it from the URL. Other query parameters are left alone.
 * `undefined` if there is no value — an empty `?cue=` is removed but changes nothing, so a stray or
 * truncated link can't turn cuesheet on.
 */
export function consumeCueParamFromUrl(): string | undefined {
  if (!isClient()) {
    return undefined
  }
  const url = new URL(window.location.href)
  const raw = url.searchParams.get(CUE_PARAM)
  if (isNil(raw)) {
    return undefined
  }
  // Drop only the cue pair, textually. Going through URLSearchParams would re-encode every other parameter
  // (`%20` → `+`, `?debug` → `?debug=`), which an app comparing its own URL would notice
  const rest = url.search
    .slice(1)
    .split('&')
    .filter((pair) => !isCuePair(pair))
  url.search = rest.length > 0 ? `?${rest.join('&')}` : ''
  window.history.replaceState(window.history.state, '', url.toString())
  return raw.trim().length === 0 ? undefined : raw
}

/**
 * Percent-encodes a `?cue=` value for a URL, leaving the characters the grammar is made of readable.
 *
 * `encodeURIComponent` would escape `,`, `:` and `/` as well, turning a link nobody can read at a glance into
 * the normal case. What must be escaped is what a query string would otherwise eat: `&` ends the parameter,
 * `#` starts the fragment, `+` decodes back as a space, `%` starts an escape of its own
 */
function encodeCueValue(value: string): string {
  return encodeURIComponent(value)
    .replaceAll('%2C', ITEM_SEPARATOR)
    .replaceAll('%3A', VALUE_SEPARATOR)
    .replaceAll('%2F', '/')
}

/**
 * The URL with `?cue=<param>` on it. Existing cue pairs are dropped textually and every other parameter is
 * carried over as it was written — going through `URLSearchParams` would re-encode them all
 * (`%20` → `+`, `?debug` → `?debug=`), so a URL the app itself put in the address bar would come back changed
 */
export function withCueParam(href: string, param: string): string {
  const url = new URL(href)
  const rest = url.search
    .slice(1)
    .split('&')
    .filter((pair) => pair.length > 0 && !isCuePair(pair))
  rest.push(`${CUE_PARAM}=${encodeCueValue(param)}`)
  url.search = `?${rest.join('&')}`
  return url.toString()
}

/**
 * Restores an ISO offset (`+09:00`, `+0900`) whose `+` became a space during query string decoding. Only after
 * a `T…` time, so a space-separated local time such as `2026-01-31 09:00` is left as it is
 */
function restoreIsoOffset(value: string): string {
  return value.replace(/(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?) (\d{2}:?\d{2})$/, '$1+$2')
}

/** A whole, non-negative number of milliseconds. `Number('')` is 0, so an empty piece must be rejected on its own */
function parseMs(value: string): number | undefined {
  return /^\d+$/.test(value) ? Number(value) : undefined
}

function parseDelay(value: string): CueState['delay'] | undefined {
  const pieces = value.split('-')
  const min = parseMs(pieces[0] ?? '')
  const max = pieces.length === 1 ? min : parseMs(pieces[1] ?? '')
  if (pieces.length > 2 || min === undefined || max === undefined || max < min) {
    return undefined
  }
  return { min, max }
}

function parseTime(value: string): CueState['time'] {
  const running = value.endsWith(RUNNING_SUFFIX)
  const now = restoreIsoOffset(running ? value.slice(0, -RUNNING_SUFFIX.length) : value)
  if (Number.isNaN(Date.parse(now))) {
    return null
  }
  return { now, mode: running ? 'running' : 'frozen' }
}

/**
 * Parses a `?cue=` value into a state, or `undefined` if the value carries nothing cuesheet understands.
 *
 * A value made up entirely of items it can't read — a typo, `?cue=OFF`, a link from another tool — leaves the
 * state alone rather than turning mocking on with the defaults. Turning it on would be the one outcome the
 * link certainly didn't ask for, and `applyUrlParams()` writes what it returns to storage, so it would stay on.
 *
 * Except for `off`, a value it does understand doesn't inherit the existing state but **starts over from the
 * defaults** — if scenarios not in the URL kept their selection from a previous link, a single link couldn't
 * fully determine the state. Every handler starts on; `-id` turns one off.
 */
export function applyCueParam(raw: string, handlers: CueHandler[]): CueState | undefined {
  const items = raw
    .split(ITEM_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (items.includes(OFF)) {
    return createDefaultState(handlers, false)
  }

  const state = createDefaultState(handlers, true)
  const byId = new Map(handlers.map((meta) => [meta.id, meta]))
  /** Whether a single item made sense. None did, and the value isn't a cue link at all */
  let understood = false

  for (const item of items) {
    if (item === ON) {
      understood = true
      continue
    }
    if (item === OFFLINE) {
      state.network.offline = true
      understood = true
      continue
    }
    if (item.startsWith(DISABLE_PREFIX)) {
      const id = item.slice(DISABLE_PREFIX.length)
      if (!byId.has(id)) {
        log.warn(`No handler named '${id}'. Available: ${[...byId.keys()].join(', ')}`)
        continue
      }
      // Merged, so `id:scenario` may come before or after it
      state.api = { ...state.api, [id]: { ...state.api[id], enabled: false } }
      understood = true
      continue
    }
    const separator = item.indexOf(VALUE_SEPARATOR)
    if (separator < 0) {
      log.warn(`'${item}' is not in 'key:value' form; skipped.`)
      continue
    }
    const key = item.slice(0, separator)
    const value = item.slice(separator + 1)

    if (key === DELAY) {
      const delay = parseDelay(value)
      if (isNil(delay)) {
        log.warn(`Couldn't parse delay '${value}'. Use 'delay:800' or 'delay:800-2000'.`)
        continue
      }
      state.delay = delay
      understood = true
      continue
    }

    if (key === TIME) {
      const time = parseTime(value)
      if (isNil(time)) {
        log.warn(`Couldn't parse time '${value}'. It must be ISO 8601.`)
        continue
      }
      state.time = time
      understood = true
      continue
    }

    const meta = byId.get(key)
    if (isNil(meta)) {
      log.warn(`No handler named '${key}'. Available: ${[...byId.keys()].join(', ')}`)
      continue
    }
    if (!isScenarioHandler(meta.handler)) {
      log.warn(`handler '${key}' has no scenarios, so '${value}' can't be applied.`)
      continue
    }
    if (!meta.handler.some((candidate) => candidate.scenario === value)) {
      const names = meta.handler.map((candidate) => candidate.scenario).join(', ')
      log.warn(`handler '${key}' has no scenario '${value}'. Available: ${names}`)
      continue
    }
    state.api = { ...state.api, [key]: { enabled: state.api[key]?.enabled ?? true, scenario: value } }
    understood = true
  }

  if (!understood) {
    log.warn(`Nothing in ?${CUE_PARAM}=${raw} could be read, so the state is left as it was.`)
    return undefined
  }
  return state
}

/** Serializes the current state as a shareable `?cue=...` value. Entries equal to the defaults are omitted */
export function toCueParam(state: CueState, handlers: CueHandler[]): string {
  if (!state.enabled) {
    return OFF
  }

  const items: string[] = [ON]
  for (const meta of handlers) {
    const setting = state.api[meta.id]
    if (isNil(setting)) {
      continue
    }
    if (!setting.enabled) {
      items.push(`${DISABLE_PREFIX}${meta.id}`)
    }
    // A turned-off handler keeps its scenario too, so turning it back on after opening the link gives the same one
    if (isNil(setting.scenario)) {
      continue
    }
    // The first scenario is the default, so there's no need to write it
    if (isScenarioHandler(meta.handler) && meta.handler[0]?.scenario === setting.scenario) {
      continue
    }
    items.push(`${meta.id}${VALUE_SEPARATOR}${setting.scenario}`)
  }

  const { min, max } = state.delay
  if (max > 0) {
    items.push(`${DELAY}${VALUE_SEPARATOR}${min === max ? min : `${min}-${max}`}`)
  }
  if (!isNil(state.time)) {
    items.push(
      `${TIME}${VALUE_SEPARATOR}${state.time.now}${state.time.mode === 'running' ? RUNNING_SUFFIX : ''}`,
    )
  }
  if (state.network.offline) {
    items.push(OFFLINE)
  }
  return items.join(ITEM_SEPARATOR)
}
