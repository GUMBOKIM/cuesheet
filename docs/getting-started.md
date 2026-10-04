# Getting started

**English** | [한국어](./getting-started.ko.md) · [All docs](./index.md)

This page covers installing cuesheet, wiring it into a Vite, webpack or Next.js app, refreshing the
screen when the state changes, and keeping cuesheet out of production builds.

**On this page**

- [Requirements](#requirements)
- [Setting up (recommended)](#setting-up-recommended)
- [Other bundlers](#other-bundlers)
- [Next.js](#nextjs)
- [Refreshing the screen when the state changes](#refreshing-the-screen-when-the-state-changes)
- [Keeping it out of production](#keeping-it-out-of-production)

## Requirements

- **A browser.** cuesheet intercepts the page's `fetch` and `XMLHttpRequest`, so requests a server
  makes (Next.js Server Components, Route Handlers) are not intercepted.
- **`msw` 2.1.3 or later** as a peer dependency — every 2.x minor from 2.1.3 up to the latest was
  checked, and 2.1.2 and below don't work (`getResponse` arrives in 2.1.3). You write handlers with
  it, so the project needs
  exactly one copy (npm 7+, pnpm and bun install it for you).
- **React 18 or 19** for `@cuesheet/react`.

## Setting up (recommended)

```bash
npm install -D cuesheet msw
npm install -D @cuesheet/react        # for the panel
```

The setup below is for Vite; [`examples/react`](../examples/react) has it in full. It has four parts.

**1. One handler per file, registered with a glob.** Put each handler in
`src/mocks/handlers/*.mock.ts` as a default export (see [One file per API](./handlers.md#one-file-per-api)).
Adding an API is then a new file, with no list to keep up to date.

**2. The instance, in a module of its own.** It collects the handlers, then reads `?cue=` and starts:

```ts
// src/mocks/cuesheet.ts
import { collectHandlers, createCuesheet } from 'cuesheet'

export const cuesheet = createCuesheet({
  baseUrl: 'https://api.example.com',
  handlers: collectHandlers(import.meta.glob('./handlers/*.mock.ts', { eager: true })),
  storage: window.localStorage,   // omit to keep state in memory only
  defaultEnabled: true,           // required: whether it's on when nothing is saved yet
})

// Before the app renders, so a ?cue= link covers the first request and the clock
cuesheet.applyUrlParams()
cuesheet.start()
```

**3. A dev-only dynamic import in the entry.** Load that module only when `import.meta.env.DEV` is true,
and render the app after it has started:

```tsx
// src/main.tsx
import type { Cuesheet } from 'cuesheet'

async function startCuesheet(): Promise<Cuesheet | undefined> {
  if (!import.meta.env.DEV) {
    return undefined
  }
  const { cuesheet } = await import('./mocks/cuesheet')
  return cuesheet
}

void startCuesheet().then((cuesheet) => {
  createRoot(document.getElementById('root') as HTMLElement).render(<App cuesheet={cuesheet} />)
})
```

> [!IMPORTANT]
> Start cuesheet **before the app renders**, so the app can't send a request or read the date before
> cuesheet is ready.

**4. The panel, lazy-loaded behind the same flag.** The app receives `cuesheet` as a prop; it is
`undefined` in production builds:

```tsx
// App.tsx
const CuesheetPanel = import.meta.env.DEV
  ? lazy(() => import('@cuesheet/react').then((module) => ({ default: module.CuesheetPanel })))
  : undefined

export default function App({ cuesheet }: { cuesheet?: Cuesheet | undefined }) {
  useEffect(() => cuesheet?.subscribe(() => queryClient.invalidateQueries()), [cuesheet])

  return (
    <>
      <CouponApp />
      {CuesheetPanel !== undefined && cuesheet !== undefined && (
        <Suspense fallback={null}>
          <CuesheetPanel cuesheet={cuesheet} />
        </Suspense>
      )}
    </>
  )
}
```

To have TypeScript check handler ids and scenario names (`select('getCoupons', 'Emtpy')` fails type
checking), declare them in a `d.ts` — see [Typed scenario names](./handlers.md#typed-scenario-names).

## Other bundlers

The same four parts work anywhere; two things change:

- **Collecting handlers.** With webpack, pass `require.context` to `collectHandlers` instead of
  `import.meta.glob` (see [One file per API](./handlers.md#one-file-per-api)), or import the handlers and
  list them in an array.
- **The dev-only condition.** Use what your bundler replaces at build time, usually
  `process.env.NODE_ENV !== 'production'`, written directly in the `if` (see
  [below](#keeping-it-out-of-production)).

## Next.js

cuesheet only sees requests made in the browser, so load the data you want to mock from Client
Components.

The [Next.js example](../examples/nextjs) has the full wiring: the instance lives in
`src/cuesheet/instance.ts`, and a provider dynamically imports it (with the panel) in development only,
calls `applyUrlParams()` and `start()`, and renders nothing until it has started.

`start()` does nothing outside the browser (it logs a warning), so an instance that gets imported during
SSR never patches the server's `fetch` or `Date`. If the instance module might be imported on the server,
guard browser-only options too:

```ts
storage: typeof window === 'undefined' ? undefined : window.localStorage
```

## Refreshing the screen when the state changes

Changing a scenario doesn't touch data the app has already fetched. Subscribe once and refetch when the
state changes:

```ts
cuesheet.subscribe(() => queryClient.invalidateQueries())
```

`subscribe` fires for every change, whether it comes from the panel, a `?cue=` link,
`window.__cuesheet__` or a test.

> [!TIP]
> The panel's `onChange` prop fires only for changes made in the panel. Use `subscribe` if anything
> else (a test, an agent) will drive the app.

## Keeping it out of production

Keeping mocks out of production builds is the app's job: cuesheet doesn't check your bundle. Installing
with `-D` doesn't keep a package out either — what you import is what gets bundled. Neither does
`defaultEnabled: false`: a `?cue=` link or saved state turns cuesheet on anyway. Keep it out by not
loading it.

Import cuesheet, `@cuesheet/react` and your handler files only through a dynamic import inside a
condition the bundler can remove, as in [the setup above](#setting-up-recommended). Write the condition
directly in the `if`:

```ts
// Vite
if (import.meta.env.DEV) {
  const { cuesheet } = await import('./mocks/cuesheet')
}

// webpack and others
if (process.env.NODE_ENV !== 'production') {
  const { cuesheet } = await import('./mocks/cuesheet')
}
```

A single static `import ... from 'cuesheet'` (or from a handler file) anywhere in the app pulls it all
back in; `import type` is fine.

> [!WARNING]
> If you store the condition in a variable first (`const ENABLED = ...`), webpack still emits the
> imported chunk.

To check a build, search its output for `__cuesheet__`: it should not be there.

---

**Next:** [Handlers and scenarios](./handlers.md) · **See also:** [React panel](./api.md#react-panel)
