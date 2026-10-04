# API reference

**English** | [한국어](./api.ko.md) · [All docs](./index.md)

Everything exported by `cuesheet`: the options, the instance methods, the state shape, handlers, records,
plugins and types. The React exports are under [React panel](#react-panel).

**On this page**

- [`createCuesheet(options)`](#createcuesheetoptions)
- [Instance methods](#instance-methods)
- [`CueState`](#cuestate)
- [`CueHandler`](#cuehandler)
- [Records](#records)
- [Plugins](#plugins)
- [React panel](#react-panel)
- [Other exports](#other-exports)

## `createCuesheet(options)`

Creates an instance. It doesn't intercept anything until `start()`.

| Option | Type | Default | Description |
|---|---|---|---|
| `handlers` | `CueHandler[]` | **required** | The APIs to mock. Checked up front; invalid definitions throw |
| `defaultEnabled` | `boolean` | **required** | Whether cuesheet (the master switch) is on when there's no saved state |
| `baseUrl` | `string` | none | Base URL of the API |
| `storage` | `CueStorage` | in memory | Where the state is saved so it survives a reload |
| `log` | `boolean` | `true` | Log intercepted requests to the console |
| `expose` | `boolean \| string` | `true` | Put the instance on `window.__cuesheet__`, or under the given name |
| `record` | `boolean \| { limit?, bodies? }` | `true` (`limit: 100`, `bodies: true`) | Record answered requests |
| `plugins` | `CuePlugin[]` | `[]` | Hooks into the request pipeline |

- `defaultEnabled`: only decides the master switch when nothing is saved yet. Every handler starts on
  either way. It's required because core doesn't know which environment it runs in.
- `baseUrl`: handler URLs can then be relative, and offline mode only fails requests to it. A path such
  as `/api` (behind a dev proxy) resolves against the page's origin, and an upper-case host or a default
  port still matches. A value that is neither a URL nor a path throws when the instance is created.
- `storage`: `window.localStorage` and `sessionStorage` work as is. See [Storage](#storage) below.
- `record`: `limit` is a whole number ≥ 0; `0` keeps none (`waitForRequest()` still resolves). `false`
  keeps none and reads no bodies, like `{ limit: 0, bodies: false }`: `waitForRequest()` and
  `subscribeRecords()` still work.

> [!IMPORTANT]
> `defaultEnabled` is not an environment gate. A `?cue=` link (`?cue=on`, say) and saved state override
> it, so `defaultEnabled: false` still lets anyone turn cuesheet on. To keep cuesheet out of production,
> don't load it: import it dynamically behind a build-time condition (see
> [Keeping it out of production](./getting-started.md#keeping-it-out-of-production)).

Every optional option also accepts `undefined`, so with `exactOptionalPropertyTypes` you can pass a
conditional value such as `storage: typeof window === 'undefined' ? undefined : window.localStorage`.

## Instance methods

### Lifecycle

| Method | Description |
|---|---|
| `applyUrlParams()` | Applies `?cue=` from the current URL and removes only that pair from the address bar. Call before `start()`. A value with nothing readable in it (a typo, or `?cue=OFF`, which is not `off`) warns and changes no state |
| `start()` | Starts intercepting `fetch` / `XMLHttpRequest` and installs the clock |
| `stop()` | Stops intercepting and restores `fetch`, `XMLHttpRequest` and `Date` |

- `applyUrlParams()`: other query parameters stay byte for byte.
- `start()`: calling it again does nothing. Outside the browser (SSR, Node) it only logs a warning. Only one instance intercepts at a time: starting another stops the one that was running, moves `window.__cuesheet__` to it, and makes `patch()` / `select()` / `reset()` on the stopped one warn and do nothing until it starts again. Running 1.0.0 alongside a later copy on one page brings back the old problem of a second instance that never intercepts.

### State

| Method | Description |
|---|---|
| `select(id, scenario)` | Selects a scenario and turns that handler on. Throws on an unknown id or scenario |
| `patch(partial)` | Changes the parts of the state you pass (a `CuePatch`, below), merged at every level |
| `getState()` | Reads the whole state |
| `reset()` | Back to the defaults |
| `subscribe(listener)` | Called on every state change, whatever caused it. Returns an unsubscribe function |
| `replaceHandlers(handlers)` | Swaps the handler list. Checked like `handlers` |

- `select()`:
  - When it throws, it lists the valid values.
  - It doesn't turn cuesheet itself on. While cuesheet is off it warns, and the selection applies once
    cuesheet is on.
  - With `CueRegistry` declared it takes literal ids and scenarios. In a custom UI where both are plain
    `string`s, cast a patch instead:
    `patch({ api: { [id]: { enabled: true, scenario } } as ApiPatch })`.
- `patch()`: with `CueRegistry` declared it checks handler ids and each handler's scenario names at compile
  time, like `select()`. Whatever it can't use at runtime is ignored with a console warning, and the rest
  applies (see [How `patch()` merges](#how-patch-merges)).
- `getState()`: returns the same object until something changes.
- `subscribe()`: the listener gets the object `getState()` now returns.
- `replaceHandlers()`: selections are kept by id; a scenario that no longer exists falls back to the
  first.

### Discovery and sharing

| Method | Description |
|---|---|
| `getCatalog()` | `Record<id, CueEntry>` for every handler, sorted by path (shape below) |
| `help()` | A plain-text cheat sheet with the live handlers, the current state and the handle to call them on |
| `toShareParam()` | The current state as a `?cue=` value, e.g. `on,getCoupons:Empty` |
| `toShareUrl()` | The current URL with that value set. Other query parameters are carried over exactly as written |

- `help()` names the handle the instance is exposed under: `window.__qa__` with `expose: '__qa__'`, or
  `cuesheet` when it isn't exposed.
- While cuesheet is off, `help()` shows every handler going to the real server, and what each would
  answer once cuesheet is on.

```ts
// returned by getCatalog(), one per handler
interface CueEntry {
  label: string
  method: string                                  // of the first scenario; 'ALL' for http.all()
  path: string
  pages?: string[]
  scenarios?: { value: string; label: string }[]  // label ?? value; absent for a single-response handler
}
```

### Record methods

| Method | Description |
|---|---|
| `getRecords(matcher?)` | Records of answered requests, oldest first, filtered by `matcher` |
| `clearRecords()` | Empties the records |
| `waitForRequest(matcher?, { timeout? })` | Resolves with the next matching record that arrives **after the call** (any record without a matcher) |
| `subscribeRecords(listener)` | Called whenever a record is added. Returns an unsubscribe function |

`waitForRequest()` rejects after `timeout` (default 5000 ms, capped at 60000 ms — `Infinity` waits 60 s).

## `CueState`

```ts
interface CueState {
  enabled: boolean
  api: Record<string, { enabled: boolean; scenario?: string }>   // scenario unset = first
  delay: { min: number; max: number }                             // ms; 0/0 = none
  time: { now: string; mode: 'frozen' | 'running' } | null        // null = real time
  network: { offline: boolean }
}

// What patch() takes. Every level is optional and merged into the current state
interface CuePatch {
  enabled?: boolean
  api?: ApiPatch
  delay?: Partial<{ min: number; max: number }>
  time?: { now: string; mode: 'frozen' | 'running' } | null
  network?: Partial<{ offline: boolean }>
}

// One handler's part of a patch
interface ApiSettingPatch<Scenario extends string = string> {
  enabled?: boolean
  scenario?: Scenario | undefined   // undefined = back to the first
}

// Keyed by handler id. With `CueRegistry` declared: { [Id in HandlerId]?: ApiSettingPatch<ScenarioOf<Id>> }
type ApiPatch = Record<string, ApiSettingPatch>
```

### `enabled` vs `api`

- `enabled` is the master switch. Every handler defaults to on, so with no other settings, turning
  cuesheet on mocks everything.
- Turning it off and on again (the panel, `patch({ enabled })`) keeps the other settings; `?cue=on`
  starts over from the defaults.
- `api[id].enabled: false` turns one handler off.

### How `patch()` merges

- A handler entry keeps the fields you leave out, so `patch({ api: { getCoupons: { enabled: false } } })`
  and then `{ enabled: true }` keeps its scenario.
- `delay` and `network` merge field by field.
- `{ api: { getCoupons: { scenario: undefined } } }` goes back to the first scenario.
- What `patch()` can't use is ignored with a console warning, and the rest of the patch still applies
  (`select()` throws instead):
  - an unknown handler id or scenario name
  - a handler entry that isn't an object
  - an invalid `time` (the clock stays as it was)
  - a negative or non-number `delay` (the delay stays as it was)
  - an `enabled` or `network.offline` that isn't a boolean (the switch stays as it was)
- For an id known only at runtime (a custom UI), cast: `{ [id]: { scenario } } as ApiPatch`.

### Delay

- Delay applies to what cuesheet answers or cuts off, never to a request that goes to the real network —
  that one already has real latency.
- So a request cut off by offline waits the delay out first, and `offline` with a delay fails the way a
  hanging connection does, with the screen's loading state visible before the error.
- The delay is whole milliseconds: fractional values are rounded, so every state can be carried by a
  link.
- A `max` below `min` is raised to `min`.
- Aborting a request during the delay (fetch's `AbortSignal`, `xhr.abort()`, axios cancellation) stops
  the wait at once: the request fails and isn't recorded. An aborted XHR ends with an `error` event
  rather than `abort`.

### Time

- Time replaces `Date.now()` and argument-less `new Date()`. Explicit dates such as
  `new Date('2026-01-01')` are unaffected.
- `time.now` is stored as ISO (`toISOString()`), so a looser form such as `'2026-01-31 09:00'` passed to
  `patch()` still makes a share link that reopens the same moment.

> [!NOTE]
> Code that captured the original `Date` before `start()` (`const now = Date.now`, a
> `class X extends Date` evaluated earlier) and engine internals such as argument-less
> `Intl.DateTimeFormat#format()` keep the real time.

### Offline

Offline fails requests with `TypeError: Failed to fetch`, the same error a browser gives. With `baseUrl`
set, only requests to it fail; without it, every intercepted request fails.

### Storage

- The state lives in memory, and every change is written through to `storage` so it survives a reload.
  Everything is kept under the single key `cuesheet:state`.
- If saving fails (private mode, a full quota, a sandboxed iframe), everything keeps working until the
  page reloads.
- Each tab keeps its own state; what's in storage when a tab loads wins.
- A malformed saved value falls back to the defaults field by field.
- `cuesheet.storage` is the store the instance ended up with — the one you passed, or memory. The panel
  remembers whether it's open through the same store, so swapping stores is done in one place.

#### Using another store

`CueStorage` is just two methods, and both may return a promise, so a database or an HTTP API
fits as well as `localStorage`:

```ts
interface CueStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
}
```

`createMemoryStorage()` is the in-memory store cuesheet falls back to; pass it explicitly to keep the
state out of browser storage altogether.

> [!IMPORTANT]
> A store that answers asynchronously can't be read before the app boots. State starts from the defaults
> and the stored one is applied a tick later, notifying subscribers — so a screen may render once with the
> defaults. Anything set in the meantime wins, so a `?cue=` link is never overwritten by a late read.
> Entering with `?cue=` stays the reliable way to fix a state.

## `CueHandler`

```ts
interface CueHandler {
  id: string                                   // unique; the state key
  label: string                                // shown in the panel
  path: string                                 // shown in the panel and catalog, used for sorting
  pages?: string[]                             // routes that use it, for the panel's page filter
  handler: HttpHandler | { scenario: string; label?: string; handler: HttpHandler }[]
}
```

- A scenario's `label` is what the panel shows (defaults to the name). The `scenario` name stays the
  value used in the state, in links and by `select()`.
- Matching uses the MSW handler's URL, not `path`. See [Handlers](./handlers.md#matching-and-baseurl).

## Records

```ts
interface CueRecord {
  requestId: string
  method: string
  url: string            // full URL
  path: string           // path + query
  handlerId?: string
  scenario?: string      // the scenario that answered (the first when none was selected); absent for single-response handlers
  status: number         // 0 when the request failed
  error?: string
  durationMs: number     // including delay
  startedAt: number      // performance.now(), unaffected by the clock
  requestBody?: unknown
  responseBody?: unknown
}

interface RecordMatcher {
  handlerId?: HandlerId    // the same name as CueRecord.handlerId
  scenario?: ScenarioName  // the scenario that answered; with a handlerId, only that handler's scenarios
  method?: string
  path?: string | RegExp   // string = substring match
  status?: number
  failed?: boolean         // true = cut off by offline mode. 4xx/5xx and HttpResponse.error() are not "failed"
}
```

> [!TIP]
> A matcher with any other key throws (`waitForRequest()` rejects), rather than silently matching every
> record. `{ id }` is the usual slip: the error tells you to use `handlerId`.

How bodies and records are captured:

- Bodies are read only for requests cuesheet answered, never for ones that went to the real network.
- Bodies are read only up to 1 MiB and for at most a second. A body still streaming after that is
  recorded with what arrived so far, ending in `…`.
- Server-Sent Events (`text/event-stream`) responses are recorded without a body.
- A record is added once its bodies have been read, so wait for one with `waitForRequest()` or by
  polling.
- `waitForRequest()` counts only requests sent after it's called, even if an earlier request's record
  lands later.

## Plugins

```ts
interface CuePlugin {
  onRequest?(context): unknown                            // return value is passed to the next two
  onResponse?(context, response, carried): void
  onError?(context, error, carried): void                 // when cuesheet failed the request
}
```

- `context` has `requestId`, `request` and `startedAt`.
- `onRequest` runs for every intercepted request, before cuesheet decides how to answer. That includes
  requests that end up going to the real network and every request while cuesheet is off, so keep it
  cheap.
- `onResponse` and `onError` run only for requests cuesheet answered or failed, after the app already has
  the response or the failure. Reading a body there never holds back a (streaming) response.
- Read the request body there too, from `context.request.clone()`.
- By then `context.meta` (a `CueResolutionMeta`) holds `{ handlerId, scenario }` if a handler answered,
  and is `undefined` otherwise (for example, offline).
- If one plugin throws, the request and the other plugins carry on.

> [!WARNING]
> The `response` handed to `onResponse` is a copy of a possibly endless stream. Read it or cancel it
> (`response.body?.cancel()`), because a copy left alone keeps everything the stream sends.

## React panel

`@cuesheet/react` exports the control panel. Mount exactly one, at the app root.

```tsx
import { CuesheetPanel } from '@cuesheet/react'

<CuesheetPanel cuesheet={cuesheet} pathname={location.pathname} />
```

To keep it out of production builds, load it behind the same dev-only flag as the instance and render it only when the instance exists:

```tsx
const CuesheetPanel = import.meta.env.DEV
  ? lazy(() => import('@cuesheet/react').then((module) => ({ default: module.CuesheetPanel })))
  : undefined

{CuesheetPanel !== undefined && cuesheet !== undefined && (
  <Suspense fallback={null}>
    <CuesheetPanel cuesheet={cuesheet} />
  </Suspense>
)}
```

> [!IMPORTANT]
> Import the panel only through that dynamic import. A static `import { CuesheetPanel } from '@cuesheet/react'` keeps the panel in production bundles even if it never renders.

| Prop | Description |
|---|---|
| `cuesheet` | The instance from `createCuesheet()` |
| `pathname` | The current route. Adds a "This page only" filter and groups APIs by each handler's `pages`. It takes a value, not a router, so any router works |
| `onChange` | Called when the state is changed **from the panel**. To refetch data use `cuesheet.subscribe()`, which also sees changes from links, tests and agents |
| `position` | `'left'` (default) or `'right'` |

Every optional prop also accepts `undefined`, so conditional values work under `exactOptionalPropertyTypes`. Whether the panel is open is remembered under `cuesheet:panel-open`, in the very store the instance uses; where that store is unavailable the panel still works and just forgets.

`CuesheetSettings` is the panel's contents without the floating shell. It takes the same props except `position`, so you can place it anywhere in a development-only page.

The styles are plain CSS that the panel injects into `<head>` the first time it mounts, so there's no CSS import to set up, and every class starts with `cue-`. The sheet is also exported as `cuesheetStyles`, and `injectStyles(root?)` puts it into `<head>` or into the `Document` / `ShadowRoot` you pass — pass the shadow root when the panel renders inside one, since outside styles don't reach in.

The bundle starts with `'use client'`, so the panel can be rendered from the Next.js App Router. cuesheet itself is still created in the browser; see the [Next.js example](../examples/nextjs).

## Other exports

- `collectHandlers(modules)`: turns bundler globs into a handler list. See
  [Handlers](./handlers.md#one-file-per-api).
- `defineCuesheet(setup)`: a typing helper for an options object kept apart from the handlers — every
  `createCuesheet` option except `handlers`, all optional. It returns `setup` unchanged.
- `http`, `HttpResponse`, `passthrough`: re-exported from `msw`.
- `CUE_PARAM`: the query parameter name, `'cue'`.
- Types: `Cuesheet` (the instance), `CuesheetOptions`, `CueSetup`, `CueHandler`, `ScenarioHandler`, `CueEntry`,
  `ScenarioOption`, `CueState`, `CuePatch`, `ApiPatch`, `ApiSettingPatch`, `ApiSetting`, `CueStorage`,
  `DelayCondition`, `TimeCondition`, `NetworkCondition`, `CueRecord`, `RecordMatcher`, `RecorderOptions`,
  `WaitOptions`, `CuePlugin`, `CueRequestContext`, `CueResolution`, `CueResolutionMeta`.
- Registry types, filled in by declaring `CueRegistry` yourself (see
  [Typed scenario names](./handlers.md#typed-scenario-names)): `CueRegistry`, `HandlerId`, `ScenarioOf`,
  `ScenarioName`, `SelectArgs`.

---

**Next:** [How it works](./how-it-works.md) · **See also:** [Handlers and scenarios](./handlers.md)
