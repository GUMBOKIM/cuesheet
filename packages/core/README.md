# cuesheet

Mock API scenarios, response delay, a controllable clock and offline mode for browser apps — built on
MSW and reproducible from a single `?cue=` link. For developers, QA, designers and AI agents alike.

## Install

```bash
npm install -D cuesheet msw
```

## Usage

Create the instance in one module:

```ts
// cuesheet.ts: only creates the instance
import { createCuesheet, http, HttpResponse } from 'cuesheet'

export const cuesheet = createCuesheet({
  baseUrl: 'https://api.example.com',
  defaultEnabled: true,            // required: whether it's on when nothing is saved yet
  storage: typeof window === 'undefined' ? undefined : window.localStorage,   // safe if imported during SSR
  handlers: [
    {
      id: 'getCoupons',
      label: 'Coupon list',
      path: '/coupons',
      handler: [
        { scenario: 'OK', handler: http.get('/coupons', () => HttpResponse.json([{ id: 'welcome', name: 'Welcome' }])) },
        { scenario: 'Empty', handler: http.get('/coupons', () => HttpResponse.json([])) },
      ],
    },
  ],
})
```

Then load it from the app's entry, before the app renders, behind a condition the bundler can remove so
it stays out of production:

```ts
// main.ts
if (process.env.NODE_ENV !== 'production') {   // use your bundler's flag, e.g. import.meta.env.DEV
  const { cuesheet } = await import('./cuesheet')
  cuesheet.applyUrlParams()   // read ?cue= first
  cuesheet.start()            // then start intercepting fetch / XHR and install the clock
}
```

`defaultEnabled` isn't what keeps cuesheet out of production: a `?cue=` link or saved state overrides it.
Not loading cuesheet is what does.

Open `/?cue=getCoupons:Empty` to get the empty list, or switch from code with
`cuesheet.select('getCoupons', 'Empty')`.

The React control panel lives in [`@cuesheet/react`](https://www.npmjs.com/package/@cuesheet/react).

## For AI agents

Point your agent instructions to `node_modules/cuesheet/AGENTS.md`. On a running page,
`window.__cuesheet__.help()` prints a cheat sheet.

---

**Documentation:** [Getting started](https://github.com/GUMBOKIM/cuesheet/blob/main/docs/getting-started.md) ·
[`?cue=` links](https://github.com/GUMBOKIM/cuesheet/blob/main/docs/cue-links.md) ·
[API reference](https://github.com/GUMBOKIM/cuesheet/blob/main/docs/api.md) ·
[All docs](https://github.com/GUMBOKIM/cuesheet/blob/main/docs/index.md)
