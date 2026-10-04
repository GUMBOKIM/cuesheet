# Testing with Playwright

**English** | [한국어](./testing.ko.md) · [All docs](./index.md)

cuesheet puts the instance on `window.__cuesheet__` (the `expose` option, on by default), so a test can
drive it from the browser context without going through the app bundle. An AI agent uses the same
object. This page covers entering a state, checking the requests the app sent, pinning the clock, and
the types and unit-test setup.

**On this page**

- [Entering a state](#entering-a-state)
- [Checking what the app sent](#checking-what-the-app-sent)
- [The clock](#the-clock)
- [Types](#types)
- [Unit tests (Vitest)](#unit-tests-vitest)
- [A worked example](#a-worked-example)

## Entering a state

Open the page with `?cue=` whenever you can. The state is then in place before the app sends its first
request or reads the date.

```ts
await page.goto(`/?cue=${encodeURIComponent('getCoupons:Empty,delay:0')}`)
await expect(page.getByText('No coupons available')).toBeVisible()
```

If the test needs a different state later, change it on the page (the app refetches if it
[subscribes](./getting-started.md#refreshing-the-screen-when-the-state-changes)):

```ts
await page.waitForFunction(() => window.__cuesheet__ !== undefined)
await page.evaluate(() => window.__cuesheet__!.select('getCoupons', 'Server error'))
```

`select()` throws on an unknown handler or scenario and lists the valid ones, so a typo fails the test
loudly. To see what's available, call `window.__cuesheet__.getCatalog()`.

> [!IMPORTANT]
> When the app loads cuesheet with a dev-only dynamic import (the
> [recommended setup](./getting-started.md#setting-up-recommended)), `window.__cuesheet__` can appear
> after the `load` event that `page.goto()` waits for. Until then `window.__cuesheet__?.…` quietly does
> nothing, so wait for it before the first call, as above. The React example's `enter()` helper does
> this after every `goto`.

## Checking what the app sent

Answered requests never reach the network, so they don't show in DevTools or in Playwright's network
events. cuesheet records them instead (the latest 100 by default).

```ts
await page.evaluate(() => {
  window.__cuesheet__!.select('redeemCoupon', 'Success')
  window.__cuesheet__!.clearRecords()
})
await page.getByRole('button', { name: 'Redeem' }).first().click()

await expect
  .poll(() => page.evaluate(() => window.__cuesheet__!.getRecords({ handlerId: 'redeemCoupon' }).length))
  .toBe(1)
const [record] = await page.evaluate(() => window.__cuesheet__!.getRecords({ handlerId: 'redeemCoupon' }))
expect(record.method).toBe('POST')
expect(record.scenario).toBe('Success')
// record.requestBody holds what the app sent, for changes you can't see on screen
```

The pattern is:

1. Clear the records.
2. Act.
3. Poll.

> [!WARNING]
> A record is added once its bodies have been read, which can be a moment after the app got the
> response, so don't read the records once right after the screen updates. `waitForRequest()` only
> counts requests sent **after** it's called, so calling it after the click misses the request the click
> sent.

### Record fields

| Field | Description |
|---|---|
| `method`, `url`, `path` | The request. `path` is path + query without the origin |
| `handlerId`, `scenario` | Which handler answered, and the scenario that answered |
| `status` | Response status. `0` if cuesheet failed the request (offline) |
| `error` | Why it failed, if it did |
| `requestBody`, `responseBody` | Parsed bodies, up to 1 MiB |
| `durationMs`, `startedAt` | Timing, including the delay |

- `scenario` is the first one when nothing was selected. It is absent only for single-response handlers.
- Turn body recording off with `record: { bodies: false }`. Server-Sent Events responses are recorded
  without a body.

### Filtering records

- Filter with `handlerId`, `scenario`, `method`, `path` (substring or RegExp), `status` and `failed`.
- **`failed: true` matches requests cuesheet cut off in offline mode.**
- A `500` response isn't `failed`; match it with `status: 500`.
- A scenario that returns `HttpResponse.error()` also fails the `fetch`, but it's recorded as an answered
  request with `status: 0`, so match it with `status: 0`.
- Any other key throws (and `waitForRequest()` rejects) instead of matching everything. The handler
  field is `handlerId`, the same name as on the record; `{ id }` throws and says so.

Requests that no handler answered go to the real network and are not recorded (unless offline mode cut
them off).

## The clock

The clock replaces `Date.now()` and `new Date()` without arguments.

> [!IMPORTANT]
> A date the app has already read (at module load, say) can't be changed afterwards, so **set the time
> in the URL you open**, not with `patch()` after the page has loaded.

```ts
await page.goto(`/?cue=${encodeURIComponent('time:2026-01-15T09:00:00Z')}`)
```

Code that captured the original `Date` before cuesheet started (`const now = Date.now`, a
`class X extends Date` evaluated earlier) and engine internals such as `Intl.DateTimeFormat#format()`
without an argument keep the real time.

> [!TIP]
> A test suite that doesn't care about time should still pin it. Otherwise fixtures with dates will
> expire as real time passes, and the tests will start failing one day. The React example pins every
> test to one day in `e2e/cue.ts`.

## Types

Importing `cuesheet` anywhere in the project, even as a type-only import, adds `__cuesheet__` to
`Window`. The `d.ts` that declares your scenario names (see
[Typed scenario names](./handlers.md#typed-scenario-names)) starts with `import 'cuesheet'`, so it already does that.

## Unit tests (Vitest)

Unit tests don't run the app's entry, so cuesheet only starts in one if the test imports the instance
module (`src/mocks/cuesheet.ts`), which calls `start()`. Don't import it there, and cuesheet won't answer
requests your unit tests mock with their own MSW handlers. Import handler files directly if a test wants
their responses.

## A worked example

[`examples/react`](../examples/react) has baseline specs, and acceptance specs for four change requests
written as `?cue=` states and record checks. Its `e2e/cue.ts` has small helpers (`enter`, `select`,
`lastRequest`) you can copy.

---

**Next:** [API reference](./api.md) · **See also:** [`?cue=` links](./cue-links.md) · [Records in the API reference](./api.md#records)
