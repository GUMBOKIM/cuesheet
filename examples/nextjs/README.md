# Coupons — cuesheet Next.js example

The same coupon app as the [React example](../react), wired into the **Next.js App Router**. The change
request / acceptance criteria workflow lives in the React example; this one only shows how to wire
cuesheet into Next.js.

```bash
# from the repository root
pnpm dev:next     # builds the packages, then http://localhost:3000
pnpm e2e:next
```

## How it's wired

| File | What it does |
|---|---|
| [`src/cuesheet/CuesheetProvider.tsx`](./src/cuesheet/CuesheetProvider.tsx) | In development only, **dynamically imports** cuesheet and turns it on; renders nothing until it's on |
| [`src/cuesheet/instance.ts`](./src/cuesheet/instance.ts) | `createCuesheet()` only; the provider calls `applyUrlParams()` and `start()`. Loaded in the browser only |
| [`src/mocks/handlers/index.ts`](./src/mocks/handlers/index.ts) | The list of handler files |
| [`app/layout.tsx`](./app/layout.tsx) | Wraps the whole app in `CuesheetProvider` |
| [`app/page.tsx`](./app/page.tsx) | Gets the instance with `useCuesheet()` and `subscribe`s — reloads when the state changes, aborting a load still in flight |

## Things to know in Next.js

- **cuesheet only intercepts the browser's fetch / XHR.** APIs the server calls directly from a Server
  Component or a Route Handler don't get mock responses. Load the data you want to control with mocks
  from a Client Component. `start()` does nothing outside the browser (it logs a warning), and
  `instance.ts` guards `window.localStorage`, so importing the instance on the server by mistake neither
  crashes nor patches the server's `fetch` / `Date`.
- **Production builds contain no cuesheet.** The dynamic import sits **inside** an
  `if (process.env.NODE_ENV !== 'production')` block, so the build removes it entirely. Verified with
  both Turbopack (default) and `next build --webpack`: zero cuesheet, msw, panel or mock data in the
  output. If you store the condition in a variable (`const ENABLED = …`), webpack still turns the
  `import()` into a chunk and ships it. Write the condition in the `if` directly.
- **Children are not rendered until cuesheet is on.** If the first request went out before
  interception, or the screen read the date before the clock was set, the `?cue=` state would not be
  reproduced. The price: **during development the server-rendered HTML is empty**, so SSR / hydration
  issues don't show with this setup. Production builds are not affected.
- **Handler files are listed by hand.** Turbopack has no folder-level import like Vite's
  `import.meta.glob`. Add a line to `src/mocks/handlers/index.ts` when you create a handler file.
- Next.js adds a route announcer with `role="alert"` to every page. When looking for an alert in tests,
  narrow the search to `main`.
