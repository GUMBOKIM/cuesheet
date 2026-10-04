# Coupons — cuesheet React example

An app that already works (v1) gets **change requests; an AI implements them; Playwright checks them using cuesheet-controlled states and request records**.

```
src/                         v1 coupon app
  mocks/handlers/*.mock.ts   one mock handler file per API — collected with import.meta.glob
  mocks/cuesheet.ts          the cuesheet instance, loaded by main.tsx on the dev server only
  cuesheet-env.d.ts          handler id / scenario types (written by hand)
requirements/CR-*.md         four change requests; acceptance criteria written as `?cue=` states
e2e/baseline/                v1 behaviour. Always passes
e2e/cr/                      acceptance criteria of the change requests. Fail until implemented
AGENTS.md                    instructions for agents
```

## Change requests

| | Requirement | What cuesheet does |
|---|---|---|
| [CR-1](./requirements/CR-1.md) | "Expiring soon" badge, expired coupons can't be redeemed | **Freezes the clock** to check the 72-hour boundary to the second |
| [CR-2](./requirements/CR-2.md) | Tell the user on 409 (already used) and reload the list | **Adds a scenario** to reproduce the 409; checks the reload in the request records |
| [CR-3](./requirements/CR-3.md) | Send the order id when redeeming | Checks a change that is invisible on screen via **request records** |
| [CR-4](./requirements/CR-4.md) | "You're offline" with a Retry button | **Goes offline** to tell a network error from a server error |

## Try it

From the repository root:

```bash
pnpm install
pnpm exec playwright install chromium   # once
pnpm dev:react                          # builds the packages, then http://localhost:5173
```

Hand it to an agent like this:

> Implement CR-1 in examples/react. Read AGENTS.md first.

```bash
cd examples/react
pnpm test:e2e        # v1 — 8 passed
pnpm test:cr         # before implementing — 10 failed / 4 passed (the "keep existing behaviour" checks pass from the start)
pnpm test:cr cr-1    # one at a time
```

## What happened when we tried (2026-09-21)

We gave four agents with no context one CR each, with a single line: "Read AGENTS.md first". All
four passed their acceptance criteria and the existing behaviour within two minutes, and the four
implementations still passed when merged. The CR-2 agent added the mock scenario on its own; the
CR-3 agent made the mock answer 400 without a body, like the real server, then removed the body on
purpose to confirm the test caught it.

Where the agents got stuck (clock default, what an offline error looks like, record fields, ports for
parallel runs, …) has been folded into AGENTS.md and the requirement docs. Reference solutions are on
the `examples/cr-solutions` branch.

## How this example uses cuesheet

- It uses `cuesheet` and `@cuesheet/react` **as if installed from npm**: it reads the built `dist`,
  not the sources, so rebuild at the repository root (`pnpm build`) after changing the library.
  (`workspace:*` only links the local packages until they are published. In a real app:
  `npm i -D cuesheet @cuesheet/react msw`.)
- **`src/mocks/cuesheet.ts`** creates the instance, collecting the handlers with
  `collectHandlers(import.meta.glob('./handlers/*.mock.ts', { eager: true }))`, then calls
  `applyUrlParams()` and `start()`. Adding an API is a new `*.mock.ts` file.
- **`src/main.tsx`** imports that module dynamically behind `import.meta.env.DEV` and renders the app once
  it has started, passing the instance to `App` as a prop. `vite build` drops the import, so the output
  contains no cuesheet, msw or mock data. Keeping it that way is the app's job: nothing else imports
  `cuesheet` or a handler file except as `import type`.
- **`src/App.tsx`** lazy-loads the panel behind the same flag. `cuesheet` is `undefined` in production
  builds, and the panel is not rendered.
- **`src/cuesheet-env.d.ts`** declares handler ids and scenario names on `CueRegistry`, so typos like
  `select('getCoupons', 'Emtpy')` fail type checking. It is written by hand: update it when a handler
  file adds or renames a scenario.
- The app reloads on state changes via `cuesheet.subscribe(load)`, so the screen follows changes made
  from the panel, the URL or `window.__cuesheet__`. A new load aborts the one still in flight, so a slow
  response from before a scenario switch can't put the old screen back.
- The tests enter via `?cue=` and drive via `window.__cuesheet__` (`e2e/cue.ts`) — the same door an
  agent uses when checking in the browser. Since cuesheet arrives by dynamic import, possibly after the
  `load` event, `enter()` waits for `window.__cuesheet__` before going on.
