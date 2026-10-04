# @cuesheet/react

React control panel for [cuesheet](https://www.npmjs.com/package/cuesheet).

## Install

```bash
npm install -D cuesheet @cuesheet/react msw
```

## Usage

```tsx
import { CuesheetPanel } from '@cuesheet/react'

<CuesheetPanel cuesheet={cuesheet} pathname={pathname} />
```

## Exports

| Export | Description |
|---|---|
| `CuesheetPanel` | A control panel that floats in a corner of the screen. Styles are injected into `<head>` once |
| `CuesheetSettings` | Just the settings UI, without the panel shell |
| `cuesheetStyles`, `injectStyles(root?)` | The panel's CSS, and a function that injects it into `<head>` or into the `Document` / `ShadowRoot` you pass (for a panel rendered in a shadow root) |

The bundle starts with `'use client'`, so it works as-is in the Next.js App Router.

---

**Documentation:** [React panel](https://github.com/GUMBOKIM/cuesheet/blob/main/docs/api.md#react-panel) ·
[All docs](https://github.com/GUMBOKIM/cuesheet/blob/main/docs/index.md)
