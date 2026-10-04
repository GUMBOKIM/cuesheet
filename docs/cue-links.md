# `?cue=` links

**English** | [한국어](./cue-links.ko.md) · [All docs](./index.md)

A `?cue=` value describes a whole cuesheet state in one string. Open the app with it and the app starts
in that state. You can hand a screen to someone else this way, and a test can start in a known state.
This page covers the syntax, how a link is applied, sharing the current state, and what a link does and
doesn't reproduce.

```text
/?cue=getCoupons:Empty,delay:800
```

**On this page**

- [Syntax](#syntax)
- [Rules](#rules)
- [Sharing the current state](#sharing-the-current-state)
- [What a link does and doesn't reproduce](#what-a-link-does-and-doesnt-reproduce)

## Syntax

Entries are separated by commas.

| Entry | Meaning |
|---|---|
| `getCoupons:Empty` | Select scenario `Empty` of handler `getCoupons` |
| `delay:800` | Delay every answered response by 800 ms (whole milliseconds) |
| `delay:800-2000` | Random delay between 800 and 2000 ms |
| `time:2026-01-31T09:00:00Z` | Freeze the clock at that moment |
| `time:2026-01-31T09:00:00Z/running` | Start the clock at that moment and let it tick |
| `offline` | Requests fail like a network error, after the delay if one is set |
| `-getCoupons` | Turn handler `getCoupons` off; its requests go to the real server |
| `-getCoupons,getCoupons:Empty` | Turn it off but keep `Empty` selected |
| `on` | Turn cuesheet on |
| `off` | Turn cuesheet off; requests go to the real server |

- `-getCoupons,getCoupons:Empty`: turning the handler back on answers with `Empty`. The two entries work
  in either order.
- `on` is implied by every entry except `off`.
- A frozen `time:` stops lodash `debounce` / `throttle` and anything else that waits on `Date.now()`;
  add `/running` for screens that rely on them ([details](./how-it-works.md)).
- `off` starts from the defaults with the master switch off: every handler stays on, and any scenario,
  `delay`, `time` or `offline` in the same link is dropped. Turning cuesheet back on then mocks
  everything with the defaults.

Examples:

```text
/?cue=redeemCoupon:Server error,delay:1500
/?cue=time:2026-01-31T23:59:00+09:00/running
/?cue=on                                       everything at its defaults
```

## Rules

### Applying a link

- **A link sets the whole state.** Anything the link leaves out goes back to its default, so handlers
  answer with their first scenario and there's no delay, no clock and no offline. A link never depends
  on what the previous one left behind, which is what makes it reproducible.
- **Every entry except `off` turns cuesheet on**, so you only need `on` for "on, with the defaults".
- **`cue` is removed from the address bar** after it's applied. Other query parameters are left alone,
  byte for byte.
- **The state survives reloads** with persistent storage (`storage: window.localStorage`, say), until something changes it.
- **An empty `?cue=`** is removed from the address bar but changes nothing. It can't turn cuesheet on.

### Mistakes in a link

- **A bad entry doesn't stop the page.** An unknown handler, an unknown scenario or an unparsable value
  logs a warning, and only that entry is skipped. For an unknown scenario, the warning lists the valid
  ones.
- **`delay:` takes whole milliseconds**, `delay:800` or `delay:800-2000`. Anything else (`delay:-500`,
  `delay:1.5`, a range that ends below where it starts) is skipped with a warning.
- **A link with nothing readable in it changes nothing at all.** If every entry was skipped — a typo, a
  link from another tool, or `?cue=OFF`, which is not the word `off` — cuesheet warns and leaves the
  state as it was, rather than reading it as "on, with the defaults" and saving that.

### Writing values

- **Time must be ISO 8601.** An offset like `+09:00` or `+0900` after a `T…` time works even though `+`
  turns into a space in a query string. A time set another way (`patch()` with `'2026-01-31 09:00'`,
  say) is stored as ISO, so its share link opens the same moment.
- **Spaces in scenario names** are fine when typing in a browser. When building a URL in code, encode
  the value with `encodeURIComponent`.
- **Every handler id and scenario name can be written in a link**, because cuesheet rejects the ones
  that couldn't when the instance is created: ids `on`, `off`, `offline`, `delay` and `time`, ids
  starting with `-`, ids containing `,` or `:`, scenario names containing `,`, empty names, and names
  with leading or trailing whitespace. See [Handler validation](./handlers.md#handler-validation).
- **`:` inside a scenario name is fine**, and so are `+`, `#` and `&` once encoded (below).

> [!WARNING]
> In a link typed by hand, write `+` as `%2B`, `#` as `%23` and `&` as `%26`. A bare `+` in a query
> string means a space, `#` starts the fragment and `&` starts the next parameter. Copy URL and
> `toShareUrl()` encode them for you.

## Sharing the current state

- **The panel:** a button copies a link to the current state.
- **`cuesheet.toShareUrl()`:** returns the current page URL with `?cue=` set.
- **`cuesheet.toShareParam()`:** returns just the value (`on,getCoupons:Empty,delay:800`).

Entries that equal the defaults are left out, so links stay short.

## What a link does and doesn't reproduce

A link reproduces **cuesheet's state** against the same app and the same handler definitions. It doesn't
capture:

- **Data outside cuesheet**, such as who is logged in, what the app keeps in its own storage, and
  responses from APIs that have no handler.
- **The exact delay when it's a range.** Only the range is reproduced.
- **Dates read before cuesheet started.** Open the page with the link rather than changing the time
  afterwards (see [Testing](./testing.md#the-clock)).

> [!NOTE]
> Whoever opens the link also needs a build where cuesheet is enabled (the dev server, or a QA build
> whose dev-only condition lets cuesheet in, such as `import.meta.env.DEV || import.meta.env.MODE === 'qa'`).

---

**Next:** [Testing with Playwright](./testing.md) · **See also:** [API reference](./api.md)
