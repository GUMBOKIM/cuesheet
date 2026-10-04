# Handlers and scenarios

**English** | [한국어](./handlers.ko.md) · [All docs](./index.md)

This page covers writing handlers and scenarios, how requests are matched, how handler definitions are
checked, splitting handlers into files, and typed scenario names.

A **handler** describes one API: an id, a label for the panel, and the MSW handler(s) that answer it.
A handler with several **scenarios** can switch between responses by name.

```ts
// src/mocks/handlers/getCoupons.mock.ts
import { http, HttpResponse, type CueHandler } from 'cuesheet'

export default {
  id: 'getCoupons',               // state key, used in ?cue= and select()
  label: 'Coupon list',           // shown in the panel
  path: '/coupons',               // shown in the panel and getCatalog(); used for sorting
  pages: ['/coupons'],            // optional: routes that use this API, for the panel's page filter
  handler: [
    { scenario: 'OK', handler: http.get('/coupons', () => HttpResponse.json([{ id: 'welcome', name: 'Welcome' }])) },
    { scenario: 'Empty', handler: http.get('/coupons', () => HttpResponse.json([])) },
    {
      scenario: 'Server error',
      handler: http.get('/coupons', () => HttpResponse.json({ message: 'Temporary error' }, { status: 500 })),
    },
  ],
} satisfies CueHandler
```

`http`, `HttpResponse` and `passthrough` are re-exported from `msw`. Importing them from `msw` works the
same.

## Scenarios

- **The first scenario is the default.** A handler answers with it until another one is selected.
- **Keep scenario names short and readable.** They are what people type into `?cue=`.
- **Spaces, `:` and `+` inside a name are fine.** A name can't be empty, contain `,`, or start or end
  with whitespace.
- **Add a `label` for the panel** when a friendlier name would help:
  `{ scenario: 'Empty', label: 'No coupons yet', handler }`. The name stays what the state, links and
  `select()` use.
- **Pass a single MSW handler** when a handler needs only one response, instead of an array:
  `handler: http.get('/me', () => HttpResponse.json(user))`.
- **No random branching inside a scenario**, on purpose, so the same state always gives the same
  screen.

### Failing one API like a network error

To make one API fail like a network error, without turning the whole app offline, add a scenario that
returns `HttpResponse.error()`:

```ts
{ scenario: 'Network error', handler: http.get('/coupons', () => HttpResponse.error()) }
```

### Selecting a scenario

- From code: `cuesheet.select('getCoupons', 'Empty')`
- From a link: `?cue=getCoupons:Empty`
- In the panel

`select()` throws on an unknown id or scenario and lists the valid values.

## Matching and `baseUrl`

Requests are matched by the **URL in the MSW handler** (`http.get('/coupons', ...)`). `path` is only
metadata for the panel and the catalog, so keep it the same as the MSW URL to avoid confusion.

With `baseUrl` set, write the MSW URLs relative:

1. cuesheet first tries the request as is.
2. If nothing matches and the request goes to `baseUrl`, it strips the base and tries again as a
   relative path.

So `https://api.example.com/coupons` is answered by `http.get('/coupons', ...)`. The rewritten request
keeps the method, headers, body, `signal`, `credentials` and `redirect` of the original.

`baseUrl` can also be a path such as `/api` (an API behind a dev proxy). It resolves against the page's
origin, and an upper-case host or a default port (`:443`) in it still matches.

Requests that no enabled handler matches go to the real network and are not recorded (unless offline mode
cuts them off first). A handler can also return `passthrough()` to let a request through.

## Handler validation

cuesheet checks the handler definitions when you create the instance (and in `replaceHandlers()`). It
throws, with every problem listed, on:

- duplicate ids
- empty scenario arrays
- duplicate scenario names
- ids or scenario names a `?cue=` link couldn't carry

A handler id can't:

- be `on`, `off`, `offline`, `delay` or `time`
- be `__proto__`, which an object can't hold as a key
- start with `-`
- contain `,` or `:`
- start or end with whitespace

A scenario name can't:

- be empty
- contain `,`
- start or end with whitespace

## One file per API

Keep one handler per file and register the whole folder. The bundler gathers the files, and
`collectHandlers` takes the result.

```ts
import { collectHandlers } from 'cuesheet'

// Vite
handlers: collectHandlers(import.meta.glob('./mocks/handlers/*.mock.ts', { eager: true }))

// webpack
const context = require.context('./mocks/handlers', false, /\.mock\.ts$/)
handlers: collectHandlers(Object.fromEntries(context.keys().map((key) => [key, context(key)])))
```

- Default and named exports are both picked up, and a file may export an array.
- A file that exports no handler logs a warning.
- Handlers are ordered by file path, so the order is the same on every build.

This is the recommended layout: adding an API is a new file, with no list to keep up to date. Pass the
result to `createCuesheet` in the module you load behind a dev-only flag, so the mock responses stay out
of production builds (see [Getting started](./getting-started.md#setting-up-recommended)).

## Typed scenario names

Declare your handler ids and scenario names on `CueRegistry` in a `d.ts`, and TypeScript checks them:

```ts
// src/cuesheet-env.d.ts
import 'cuesheet'

declare module 'cuesheet' {
  interface CueRegistry {
    getCoupons: 'OK' | 'Empty' | 'Server error'
    redeemCoupon: 'Success' | 'Server error'
  }
}
```

```ts
cuesheet.select('getCoupons', 'Emtpy')   // type error: not a scenario of 'getCoupons'
cuesheet.patch({ api: { getCoupons: { scenario: 'Emtpy' } } })   // the same check
```

The file is written by hand: update it when a handler file adds or renames a scenario. Without it, ids and
scenario names are plain `string`.

For an id known only at runtime (a custom UI), cast: `{ [id]: { scenario } } as ApiPatch`.

---

**Next:** [`?cue=` links](./cue-links.md) · **See also:** [`CueHandler` in the API reference](./api.md#cuehandler)
