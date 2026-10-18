# How it works

**English** | [한국어](./how-it-works.ko.md) · [All docs](./index.md)

This page explains the single state object behind cuesheet, the path a request takes through it, why it
doesn't use a service worker, and its limits.

**On this page**

- [One state object](#one-state-object)
- [The request pipeline](#the-request-pipeline)
- [Why no service worker](#why-no-service-worker)
- [Limits](#limits)

## One state object

A single `CueState` object decides everything cuesheet does: which scenario each handler answers with,
the delay, the clock, and whether the network is offline.

The panel, `?cue=` links and the code API (`window.__cuesheet__`, `select()`, `patch()`) all read and
write that one object. So a scenario picked in the panel shows up in the share link, and a test sees the
same thing a person does.

The state lives in memory:

- With persistent storage (`storage: window.localStorage`, say), every change is also written there,
  so the state survives reloads.
- If saving fails, everything keeps working until the page reloads.
- Each tab keeps its own state, and what's in storage when a tab loads wins.

## The request pipeline

When cuesheet is off, every request goes straight to the network (plugins' `onRequest` still sees it).
When it's on:

```text
request ─▶ plugin.onRequest ─▶ offline? ─── yes ─▶ delay ─▶ fail with TypeError ─▶ record · plugin.onError
                                  │
                                  no
                                  ▼
                        an enabled handler matches?
                                  │
                   ┌──── yes ─────┴───── no ────┐
                   ▼                            ▼
                 delay                  real network (not recorded)
                   │
                   ▼
               response ─▶ record · plugin.onResponse
```

- **Plugins carry their own context.** Whatever `onRequest` returns is passed to `onResponse` or
  `onError`, so a plugin doesn't need its own storage to connect the two.
- **Responses aren't held back.** The app gets the response (or the failure) before `onResponse` /
  `onError` run, so reading the body for a record or a log never holds back a response, even a
  streaming one.
- **Only answered requests have their bodies read**, for at most 1 MiB and one second.
- **`onRequest` runs for every intercepted request**, including ones that end up going to the real
  network and every request while cuesheet is off, so keep it cheap.
- **Aborting during the delay stops the wait at once** (fetch or XHR, so axios cancellation too); the
  request fails and isn't recorded. The interceptor doesn't pass `xhr.abort()` on, so cuesheet wraps
  `abort()` on each intercepted XHR to notice it.
- **A throwing plugin doesn't break anything.** The request and the other plugins carry on.
- **The state is read again for every request**, so a change applies to the very next one.

> [!WARNING]
> XHR is the exception for streaming: the interceptor measures a mocked body before handing it to an
> XHR, so an XHR sees a streamed response only once it ends. fetch gets it as it streams.

## Why no service worker

In the browser, MSW usually runs in a service worker. cuesheet doesn't:

- The release WebView in Capacitor apps blocks service worker fetch interception
  ([ionic-team/capacitor#7069](https://github.com/ionic-team/capacitor/issues/7069)).
- Using a service worker only on the web would split the transport in two.

So cuesheet patches `fetch` and `XMLHttpRequest` with
[`@mswjs/interceptors`](https://github.com/mswjs/interceptors), which works in both. Your handlers are
still ordinary MSW handlers.

## Limits

- **Only `fetch` and `XMLHttpRequest` in the page are intercepted.** axios uses XHR in the browser, so
  it's covered. Requests made by `<img>`, CSS or `<script>` are not; use DevTools network throttling for
  those.
- **Only the browser.** Requests made on a server (Next.js Server Components, Route Handlers) are not
  intercepted. `start()` does nothing outside the browser (it logs a warning), so an instance imported
  during SSR never patches the server's `fetch` or `Date`. Matching relative handler URLs also needs a
  page origin, so cuesheet doesn't answer requests in plain Node.
- **The clock can't change dates the app has already read.** Enter with `?cue=time:...` so it's in
  place before the app boots. Code that captured the original `Date` earlier (`const now = Date.now`, a
  `class X extends Date`) and engine internals such as argument-less `Intl.DateTimeFormat#format()` keep
  the real time.
- **A frozen clock stops anything that measures time with `Date.now()`.** `setTimeout` still fires, but
  code that checks how much time has passed sees none: lodash `debounce` / `throttle` never call through,
  so a debounced search box or autosave does nothing. Use `time:.../running` on screens that depend on
  them, and keep the frozen clock for exact boundaries.
- **A running clock starts over from its `time:` value each time it is applied.** Turning cuesheet off
  and on, `stop()` then `start()`, or setting `time` again all put `Date.now()` back at that moment,
  so the same link always opens at the same time. Code that compares timestamps across one of these
  sees time go backwards.
- **Answered requests don't appear in the DevTools Network panel**, because they never reach the
  network. Use the records or the panel's request list.
- **Delay applies to what cuesheet answers or cuts off**, never to a request that goes to the real
  network — that one already has real latency.
- **A delay is not a timeout.** `xhr.timeout` (which is what axios's `timeout` option sets) never fires
  for a request cuesheet answers: the interceptor underneath, `@mswjs/interceptors`, doesn't emulate it,
  and msw behaves the same way. So `delay:5000` against `axios.get(url, { timeout: 1000 })` still
  delivers the response after 5 s instead of failing. To exercise timeout handling, give the handler a
  scenario that returns `HttpResponse.error()`, or turn `offline` on.

---

**See also:** [CONTRIBUTING.md](../CONTRIBUTING.md) for the packages' internal layout · [API reference](./api.md) · [All docs](./index.md)
