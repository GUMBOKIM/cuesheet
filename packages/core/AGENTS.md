# cuesheet — guide for agents

This app uses **cuesheet**: it answers the app's API requests with mock responses and decides the
delay, the clock and the network. You use it to put the app into an exact state, check what the screen
does, and see what the app sent. Everything here works the same from Playwright, a browser console or
an agent driving the browser.

Short version, live from the running app: `window.__cuesheet__.help()`.

## Find the setup

Look for `createCuesheet(` — the options and the handler list are passed there. Handlers usually come
from one file per API, gathered with a bundler glob: `collectHandlers(import.meta.glob(...))` in Vite,
`require.context` in webpack. The glob shows which folder and file names count as handlers.

The app usually loads that module with a dynamic import behind a development-only flag, so cuesheet is
on only in development and production builds carry none of it. Where it isn't loaded, the instance the
app passes around is `undefined`.

## Put the app in a state

**Enter with `?cue=` — the most reliable way.** Anything not in the value starts from the defaults, so
one URL fully decides the state:

```
/?cue=on,getCoupons:Empty                        a scenario for one handler
/?cue=on,redeemCoupon:Server error,delay:800     several items, comma-separated
/?cue=on,delay:800-2000                          random delay in a range (ms)
/?cue=on,time:2026-01-15T09:00:00Z               frozen clock
/?cue=on,time:2026-01-15T09:00:00Z/running       clock that starts there and ticks
/?cue=on,offline                                 API requests fail like a network error
/?cue=-getCoupons                                one handler off, its requests go to the real server
/?cue=off                                        cuesheet off, requests go to the real server
```

Spaces in scenario names are fine in a browser; URL-encode the value when building URLs in code. In a
hand-typed link, write `+`, `#` and `&` as `%2B`, `%23` and `%26` — `toShareUrl()` already does. The app
removes `?cue=` from the address bar once it has read it. A value with nothing readable in it (a typo, or
`?cue=OFF`, which is not `off`) is dropped from the URL with a console warning and changes no state.

**Change it after entering** — the screen updates if the app subscribes (see "Behaviour"):

```ts
window.__cuesheet__.getCatalog()                   // handler ids, methods, paths, scenario names
window.__cuesheet__.select('getCoupons', 'Empty')  // throws with the valid values on a typo
window.__cuesheet__.patch({ enabled: true })       // the master switch on; each handler keeps its own setting
window.__cuesheet__.patch({ network: { offline: false } })  // patch merges; fields you leave out stay
window.__cuesheet__.patch({ delay: { min: 0, max: 0 } })
window.__cuesheet__.reset()                        // back to the defaults
window.__cuesheet__.getState()                     // the current state
window.__cuesheet__.toShareUrl()                   // a URL that reproduces the current state
```

With no scenario selected, a handler answers with its **first** scenario. `select()` turns that handler on
but not cuesheet itself: if `getState().enabled` is `false` it warns, and the selection applies once you
turn cuesheet on. `patch()` ignores what it can't use (an unknown id or scenario, an invalid `time`, a
negative `delay`) with a console warning and applies the rest — check the console if nothing changed.

## See what the app sent

Mock responses never touch the network, so they don't show in the DevTools Network tab. Use the
records instead — this is how you check changes that are invisible on screen (request bodies, retries,
call counts):

```ts
window.__cuesheet__.getRecords({ handlerId: 'redeemCoupon' })
window.__cuesheet__.getRecords({ handlerId: 'getCoupons', scenario: 'Empty' })
window.__cuesheet__.getRecords({ method: 'POST', path: '/coupons', failed: true })
window.__cuesheet__.clearRecords()
await window.__cuesheet__.waitForRequest({ handlerId: 'redeemCoupon' })  // only requests from now on
// filter keys: handlerId, scenario, method, path, status, failed — any other (e.g. id) throws
```

A record looks like:

```ts
{ method: 'POST', path: '/coupons/welcome/redeem', handlerId: 'redeemCoupon', scenario: 'Success',
  status: 200, requestBody: { orderId: 'A-1001' }, responseBody: { ... }, durationMs: 3 }
// `scenario` is the one that answered, the default included; absent only for single-response handlers
// a request cut off by offline: status: 0, error: 'Failed to fetch', no handlerId
```

JSON bodies are stored parsed (up to 1 MiB, read for at most a second — a longer stream is kept up to that
point, ending in `…`; Server-Sent Events responses have no body). A record is added once its bodies are
read, so wait with `waitForRequest()` or poll. `waitForRequest()` counts only requests sent after the call. Only requests cuesheet handled are
recorded (mocked or cut off by offline); requests that went to the real server aren't.

## Add or change a mock response

One file per API. When a requirement mentions a response that doesn't exist yet (a 409, an empty list,
a slow endpoint), **add a scenario to that API's file**; for a new API, add a new file.

```ts
import { http, HttpResponse, type CueHandler } from 'cuesheet'

export default {
  id: 'getCoupons',            // unique; used in ?cue= and select()
  label: 'Coupon list',        // shown in the panel
  path: '/coupons',            // shown in the panel; keep it equal to the msw URL
  pages: ['/checkout'],        // optional: pages that call it, for the panel's filter
  handler: [
    { scenario: 'OK', handler: http.get('/coupons', () => HttpResponse.json(coupons)) },
    { scenario: 'Empty', handler: http.get('/coupons', () => HttpResponse.json([])) },
    {
      scenario: 'Server error',
      handler: http.get('/coupons', () => HttpResponse.json({ message: 'Temporary error' }, { status: 500 })),
    },
  ],
} satisfies CueHandler
```

`handler` can also be a single msw handler when there's only one response. Handlers are plain
[msw](https://mswjs.io) handlers, so `params`, `request.json()` and `HttpResponse` all work as usual.
Put the realistic response first — it's the default. Ids and scenario names must fit in a `?cue=` link,
or creating the instance throws: an id can't be `on`, `off`, `offline`, `delay`, `time` or `__proto__`,
start with `-`, or contain `,` or `:`; a scenario name can't be empty or contain `,`; neither can start or
end with whitespace.

Handler ids and scenario names are typed by a `CueRegistry` declaration, if the project has one (look for
`interface CueRegistry`). It is written by hand: when you add or rename a scenario, update it too.

## Playwright

Everything goes through `window.__cuesheet__`:

```ts
await page.goto(`/?cue=${encodeURIComponent('on,getCoupons:Empty,time:2026-01-15T09:00:00Z')}`)
// A dynamically imported instance can show up after the load event goto() waits for
await page.waitForFunction(() => window.__cuesheet__ !== undefined)
await page.evaluate(() => window.__cuesheet__?.select('getCoupons', 'Server error'))
const sent = await page.evaluate(() => window.__cuesheet__?.getRecords({ handlerId: 'redeemCoupon' }) ?? [])
```

Poll for records (`expect.poll`) rather than reading them once right after a click.

## Behaviour worth knowing

- **The clock covers `Date.now()`, `new Date()` and `Date()`**, so app code needs no changes. Code that
  captured the original `Date` before cuesheet started (`const now = Date.now`, a `class X extends Date`
  evaluated earlier) and engine internals such as argument-less `Intl.DateTimeFormat#format()` keep the
  real time.
- **Set the clock by entering with `time:`.** Changing `time` after the app has booted doesn't change
  dates the app already read. `time:` is frozen by default; append `/running` to let it tick. Use a
  frozen clock for exact boundaries. A frozen clock stops `Date.now()`-based waits — lodash
  `debounce` / `throttle` never call through — so use `/running` on screens that debounce or autosave.
- **One instance answers at a time.** Starting a second instance stops the one that was running, and
  `window.__cuesheet__` follows the new one. Changes made through the stopped one are ignored with a warning.
- **State outlives a reload** when the instance is given `window.localStorage` as its storage, so a reload keeps
  the last state — including one left behind by an earlier session. Enter with `?cue=` or call `reset()` to start clean.
  Each tab keeps its own state; what's in storage when a tab loads wins.
- **The screen follows state changes only if the app subscribes** (`cuesheet.subscribe(reload)`).
  Otherwise, change the state and reload the page, or enter with `?cue=` again.
- **Offline makes `fetch` throw** `TypeError('Failed to fetch')`, like a real network error. That's
  different from a server answering with an error status. With a `baseUrl`, only requests to it fail.
  A delay applies to it as well, so `offline,delay:800` fails the way a hanging connection does.
- **A delay is not a timeout.** `xhr.timeout` / axios's `timeout` never fires for a request cuesheet
  answers (the msw interceptor underneath doesn't emulate it). To check timeout handling, use a scenario
  returning `HttpResponse.error()`, or `offline`.
- **To fail just one request with a network error, use a scenario, not offline.** Offline cuts every
  API request, and an app that reloads on state changes then fails its reload too, so there's nothing left
  to click. A scenario returning `HttpResponse.error()` makes only that API's `fetch` throw.
- **Only `fetch` and `XMLHttpRequest` are intercepted.** Images and CSS requests aren't.
- **Requests that no handler matches go to the real server**, silently. So do requests for handlers
  turned off in the panel. If a screen shows real data, check `getCatalog()` for the path first.

## Don't

- **Don't import `cuesheet`, `@cuesheet/react` or a handler file statically from app code**, and don't
  create a second instance. Use the instance the project already creates. A static import puts mocks in
  the production bundle; keep anything new behind the same development-only dynamic import.
- Don't assume a scenario name — read it from `getCatalog()` or the handler file. `select()` throws on
  typos; `patch()` ignores an unknown id or scenario with a console warning, so check the console.
