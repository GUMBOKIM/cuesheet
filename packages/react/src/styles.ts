/** Attribute marking the styles as injected. Injected only once even if mounted several times */
const MARKER = 'data-cuesheet'

/**
 * Panel styles. Everything uses the `cue-` prefix so it doesn't mix with app styles, and
 * fonts and colors are all set explicitly so the app's global CSS has less effect.
 *
 * Colors are taken straight from Tailwind's gray, blue and green palettes — the same tone as the original mock panel.
 */
export const CSS = `
.cue-root {
  --cue-gray-50: #f9fafb;
  --cue-gray-100: #f3f4f6;
  --cue-gray-200: #e5e7eb;
  --cue-gray-300: #d1d5db;
  --cue-gray-400: #9ca3af;
  --cue-gray-500: #6b7280;
  --cue-gray-600: #4b5563;
  --cue-gray-700: #374151;
  --cue-gray-900: #111827;
  --cue-blue-50: #eff6ff;
  --cue-blue-300: #93c5fd;
  --cue-blue-600: #2563eb;
  --cue-blue-700: #1d4ed8;
  --cue-green-600: #16a34a;
  --cue-green-700: #15803d;
  --cue-red-600: #dc2626;
  --cue-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  position: fixed;
  bottom: calc(8px + env(safe-area-inset-bottom));
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--cue-gray-900);
  -webkit-font-smoothing: antialiased;
}
.cue-root *, .cue-root *::before, .cue-root *::after { box-sizing: border-box; }
.cue-root[data-position='left'] { left: 8px; }
.cue-root[data-position='right'] { right: 8px; align-items: flex-end; }

.cue-launcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  border-radius: 999px;
  background: var(--cue-gray-900);
  color: #fff;
  padding: 6px 12px;
  font: 700 12px/1 var(--cue-mono);
  cursor: pointer;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 20%), 0 4px 6px -4px rgb(0 0 0 / 20%);
  transition: background-color 120ms;
}
.cue-launcher:hover { background: var(--cue-gray-700); }
.cue-launcher::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #4ade80;
}
.cue-launcher[data-on='false']::before { background: var(--cue-gray-500); }

.cue-panel {
  display: flex;
  flex-direction: column;
  width: 380px;
  max-width: calc(100vw - 16px);
  max-height: 70vh;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--cue-gray-300);
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
}
.cue-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--cue-gray-200);
}
.cue-title { font-size: 14px; font-weight: 700; }
.cue-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px; }
.cue-foot {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--cue-gray-200);
  background: #fff;
}
.cue-foot label { cursor: pointer; }
.cue-foot-label { font-size: 13px; font-weight: 600; }
.cue-foot-state { font-size: 12px; font-weight: 600; color: var(--cue-gray-400); }
.cue-foot-state[data-on='true'] { color: var(--cue-blue-600); }

.cue-card {
  margin-bottom: 12px;
  padding: 12px;
  background: var(--cue-gray-50);
  border: 1px solid var(--cue-gray-200);
  border-radius: 8px;
}
.cue-card > * + * { margin-top: 8px; }
.cue-card-title { font-size: 13px; font-weight: 600; }
.cue-row { display: flex; align-items: center; gap: 8px; }
.cue-stack { display: flex; flex-direction: column; gap: 8px; }
.cue-clock-input { width: 100%; }
.cue-spread { justify-content: space-between; }
.cue-muted { color: var(--cue-gray-500); font-size: 12px; }
.cue-dim { opacity: 0.5; }
.cue-dim .cue-list, .cue-dim .cue-card { pointer-events: none; }

/* Switch: keeps the checkbox and only restyles it — screen readers and tests still see a checkbox */
.cue-switch {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 36px;
  height: 20px;
  margin: 0;
  border-radius: 999px;
  background: var(--cue-gray-200);
  cursor: pointer;
  transition: background-color 150ms;
}
.cue-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid var(--cue-gray-300);
  transition: transform 150ms;
}
.cue-switch:checked { background: var(--cue-blue-600); }
.cue-switch:checked::after { transform: translateX(16px); border-color: #fff; }
.cue-switch:focus-visible { outline: 3px solid var(--cue-blue-300); outline-offset: 1px; }
.cue-switch:disabled { opacity: 0.5; cursor: not-allowed; }

.cue-check { accent-color: var(--cue-blue-600); margin: 0; }

.cue-btn {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: background-color 120ms;
}
.cue-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cue-btn-primary { background: var(--cue-blue-600); color: #fff; }
.cue-btn-primary:hover { background: var(--cue-blue-700); }
.cue-btn-secondary { background: var(--cue-gray-200); color: var(--cue-gray-700); }
.cue-btn-secondary:hover { background: var(--cue-gray-300); }
.cue-btn-success { background: var(--cue-green-600); color: #fff; }
.cue-btn-success:hover { background: var(--cue-green-700); }
.cue-copy { flex: 0 0 auto; padding: 6px 12px; }
/* Shown on its own row when the URL couldn't be copied, so it can be copied by hand */
.cue-copy-fallback { flex: 1 1 100%; font-size: 12px; }
.cue-btn-ghost {
  flex: 0 0 auto;
  padding: 4px 8px;
  background: transparent;
  color: var(--cue-gray-500);
}
.cue-btn-ghost:hover:not(:disabled) { background: var(--cue-gray-100); }

.cue-input, .cue-select {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--cue-gray-300);
  border-radius: 6px;
  background: #fff;
  font: inherit;
  color: inherit;
}
.cue-input:focus, .cue-select:focus { outline: 2px solid var(--cue-blue-300); outline-offset: 0; }
.cue-input { flex: 1; }
.cue-select { width: 100%; }
.cue-select:disabled { background: var(--cue-gray-100); color: var(--cue-gray-400); }

.cue-slider { display: flex; align-items: center; gap: 10px; }
.cue-slider-label { width: 28px; color: var(--cue-gray-500); font-size: 12px; }
.cue-slider input[type='range'] { flex: 1; min-width: 0; accent-color: var(--cue-blue-600); }
.cue-slider-value {
  width: 56px;
  text-align: right;
  font: 12px var(--cue-mono);
  color: var(--cue-gray-700);
}

.cue-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.cue-search { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.cue-search label { flex: 0 0 auto; display: flex; align-items: center; gap: 4px; }

.cue-group + .cue-group { margin-top: 16px; }
.cue-group-head {
  position: sticky;
  top: -12px;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--cue-gray-200);
  border-bottom: 1px solid var(--cue-gray-200);
  background: #fff;
}
.cue-group-title { font-size: 12px; font-weight: 600; color: var(--cue-gray-700); }
.cue-group-count { font-size: 12px; color: var(--cue-gray-400); }

.cue-list { display: flex; flex-direction: column; gap: 8px; }
.cue-item {
  padding: 10px;
  border: 1px solid var(--cue-gray-200);
  border-radius: 8px;
  background: #fff;
  transition: background-color 120ms;
}
.cue-item:hover { background: var(--cue-gray-50); }
.cue-item-main { min-width: 0; flex: 1; }
.cue-item-label { font-size: 13px; font-weight: 500; }
.cue-item-path {
  margin-top: 2px;
  color: var(--cue-gray-500);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.cue-item-side { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; }
.cue-item-status { font-size: 12px; color: var(--cue-gray-600); }
.cue-item .cue-select { margin-top: 8px; }
.cue-method {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--cue-gray-100);
  font: 11px var(--cue-mono);
  color: var(--cue-gray-700);
  text-transform: uppercase;
}
.cue-empty {
  padding: 16px;
  border-radius: 8px;
  background: var(--cue-gray-50);
  color: var(--cue-gray-500);
  font-size: 13px;
}

.cue-records { display: flex; flex-direction: column; gap: 2px; }
.cue-record {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 4px 6px;
  border-radius: 4px;
  font: 11px var(--cue-mono);
}
.cue-record:nth-child(odd) { background: var(--cue-gray-50); }
.cue-record .cue-method { margin-right: 0; }
.cue-record-path { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cue-record-status { font-weight: 700; color: var(--cue-green-600); }
.cue-record[data-failed='true'] .cue-record-status { color: var(--cue-red-600); }
.cue-record-time { color: var(--cue-gray-400); }
`

/**
 * Injects the styles once into `root`: the document's `<head>` by default, or a shadow root the panel is rendered
 * in (styles outside a shadow root don't reach inside it). Does nothing outside the browser
 */
export function injectStyles(root?: Document | ShadowRoot): void {
  if (typeof document === 'undefined') {
    return
  }
  const target = root ?? document
  if (target.querySelector(`style[${MARKER}]`) !== null) {
    return
  }
  const style = document.createElement('style')
  style.setAttribute(MARKER, '')
  style.textContent = CSS
  // A document takes the style in <head>; a shadow root takes it directly
  ;('head' in target ? target.head : target).appendChild(style)
}
