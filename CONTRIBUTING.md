# Contributing

How to set up the workspace, how the code is laid out, and the rules for documentation and publishing.

## Setup

This is a pnpm workspace.

```bash
pnpm install
pnpm exec playwright install chromium   # once, for the e2e suites
```

| Command | What it does |
|---|---|
| `pnpm test` | Vitest in every package |
| `pnpm typecheck` | Packages and examples |
| `pnpm lint` | Biome: lint, format and import order. `pnpm lint:fix` applies what it can |
| `pnpm --filter cuesheet test:msw` | The core suite against msw 2.1.3, 2.4, 2.8, 2.11 and 2.14 |
| `pnpm build` | tsup: ESM + CJS + d.ts per package |
| `pnpm dev:react` / `pnpm dev:next` | Build the packages, then run an example |
| `pnpm e2e:react` / `pnpm e2e:next` | Build the packages, then run an example's Playwright suite |

Biome is configured in `biome.json`: two-space indent, single quotes, no semicolons, 110 columns. Linter, formatter and import sorting are all on, for TS, JS, JSX, JSON and CSS. `.gitignore` is honoured, and the generated `cuesheet-env.d.ts` is skipped. The panel's stylesheet lives in a template literal in `packages/react/src/styles.ts`, which the CSS formatter does not reach — keep writing it the way it is.

Inside the workspace, `@cuesheet/react` reads core's `src` through the `@cuesheet/source` export condition, so its tests run without building core.

> [!IMPORTANT]
> **The examples read `dist`, like a package installed from npm**, so run `pnpm build` after changing a library (`dev:*` and `e2e:*` do it for you).
> The React example also sets `optimizeDeps: { force: true }`: Vite pre-bundles `cuesheet` and keys that cache on the lockfile, not on `dist`. Without it a rebuilt library would sit behind a cache the e2e suite happily passes against.

## Layout

```text
packages/
  core/     cuesheet
  react/    @cuesheet/react   (uses only cuesheet's public API)
examples/
  react/    Vite + React: change requests → implementation → verification
  nextjs/   wiring into the Next.js App Router
docs/       user documentation (English + .ko.md)
```

Inside core, dependencies flow one way:

```text
handler  ←  state  ←  resolver  ←  createCuesheet
                      transport ←
                      conditions ←
```

```text
packages/core/src/
  createCuesheet.ts   assembly and the public API
  resolver.ts         state + handlers → how to answer this request
  handler/            handler definitions. The bottom layer; depends on nothing else
  state/              state schema, persistence, subscriptions
  record/             request records, queries, waiting
  conditions/         delay and clock
  transport/          fetch / XHR interception and the plugin pipeline
  url/                ?cue= parsing and serialization
  util/
```

`transport` knows nothing about handlers or the state shape. All it gets is one function, `resolve(request) => CueResolution | undefined`, and it doesn't care how that function decides.

## Documentation

- The README and every page in `docs/` exist in English and Korean (`*.ko.md` next to the English file). Change both in the same commit.
- `packages/core/AGENTS.md` ships in the npm package and is written for agents. Keep it short and operational; the README's "With an AI" section is what points readers to it.
- The diagrams are generated, each in English and Korean: `docs/structure.py` → `structure.svg` / `structure.ko.svg`, and `docs/loop.py` → `loop.svg` / `loop.ko.svg`. Edit the script and run `python3 docs/<name>.py`.

## Publishing

> [!WARNING]
> Always publish with `pnpm publish`. It replaces the `workspace:` protocol with real versions; `npm publish` doesn't, and would publish a broken package.

The three packages release together on one version, so bump them in one go:

```bash
pnpm version:set 1.1.0     # every package in packages/*, no git tag
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter cuesheet test:msw    # the peer range's older msw versions
pnpm e2e:react && pnpm e2e:next
pnpm publish:dry           # what would be published, without publishing
```

`pnpm publish:dry` is a dry run of the real thing. To see exactly what lands in a tarball, including the rewritten `workspace:^` peers and the stripped `@cuesheet/source` dev condition, run `pnpm pack` in a package and unpack the result.

---

**See also:** [How it works](./docs/how-it-works.md) · [All docs](./docs/index.md)
