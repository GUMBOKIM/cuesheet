import type { CueEntry, Cuesheet } from 'cuesheet'
import { useInsertionEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CopyUrlButton } from './CopyUrlButton'
import { injectStyles } from './styles'
import { useCueRecords } from './useCueRecords'
import { useCueState } from './useCueState'

export interface CuesheetSettingsProps {
  cuesheet: Cuesheet
  /**
   * Current page path. When given, the 'This page only' filter is enabled and shows just that page's APIs.
   * Taken as a value so it isn't tied to a router (e.g. `useLocation().pathname`)
   */
  pathname?: string | undefined
  /**
   * Called only when the state is changed from the panel.
   *
   * To re-render the screen with new responses, prefer
   * `cuesheet.subscribe(...)` over this prop — it also catches changes made through the URL or
   * `window.__cuesheet__`. Use this prop when you need to react to panel actions only
   */
  onChange?: (() => void) | undefined
}

type Entry = [string, CueEntry]

/** ISO → the local time string `<input type="datetime-local">` accepts */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  // Seconds included, so a boundary like 23:59:59 survives touching the field
  return `${ymd}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function fromLocalInput(value: string): string | undefined {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** The cuesheet control UI. Can also be placed directly on a page without the panel */
export function CuesheetSettings({ cuesheet, pathname, onChange }: CuesheetSettingsProps) {
  const state = useCueState(cuesheet)
  const records = useCueRecords(cuesheet)
  // Changing handlers (HMR) sends a state notification, so state is a dependency
  // biome-ignore lint/correctness/useExhaustiveDependencies: a state change is the catalog refresh signal
  const catalog = useMemo(() => cuesheet.getCatalog(), [cuesheet, state])

  const [keyword, setKeyword] = useState('')
  const [thisPageOnly, setThisPageOnly] = useState(pathname !== undefined)

  const bodyRef = useRef<HTMLDivElement>(null)

  // Before the first paint, so the panel never shows unstyled for a frame
  useInsertionEffect(() => {
    injectStyles()
  }, [])

  // A shadow root doesn't get the document's styles, so one rendered inside it needs its own copy
  useLayoutEffect(() => {
    const root = bodyRef.current?.getRootNode()
    if (root instanceof ShadowRoot) {
      injectStyles(root)
    }
  }, [])

  /**
   * Entries that pass the search and 'this page' filters. Shared APIs pass either way — an empty `pages`
   * counts as unset, the same way the grouping below treats it, so one can't hide a handler from the list
   */
  const visible = useMemo<Entry[]>(() => {
    const needle = keyword.trim().toLowerCase()
    return Object.entries(catalog).filter(([id, entry]) => {
      if (
        thisPageOnly &&
        pathname !== undefined &&
        entry.pages !== undefined &&
        entry.pages.length > 0 &&
        !entry.pages.some((page) => pathname.startsWith(page))
      ) {
        return false
      }
      if (needle.length === 0) {
        return true
      }
      return [id, entry.label, entry.path].some((text) => text.toLowerCase().includes(needle))
    })
  }, [catalog, keyword, pathname, thisPageOnly])

  /** Two groups (page-specific / shared) when the 'this page' filter is on, otherwise one group with everything */
  const groups = useMemo(() => {
    if (!thisPageOnly || pathname === undefined) {
      return [{ title: 'All', entries: visible }]
    }
    const page = visible.filter(([, entry]) => entry.pages !== undefined && entry.pages.length > 0)
    const common = visible.filter(([, entry]) => entry.pages === undefined || entry.pages.length === 0)
    return [
      { title: 'This page', entries: page },
      { title: 'Common', entries: common },
    ].filter((group) => group.entries.length > 0)
  }, [visible, thisPageOnly, pathname])

  function update(next: Parameters<Cuesheet['patch']>[0]) {
    cuesheet.patch(next)
    onChange?.()
  }

  /** Only the handlers — the master switch at the bottom stays as it is, and so do the clock, delay and network */
  function setAll(enabled: boolean) {
    update({ api: Object.fromEntries(Object.keys(catalog).map((id) => [id, { enabled }])) })
  }

  const time = state.time

  return (
    <>
      <div className="cue-body" ref={bodyRef}>
        {/* When the master switch is off, everything below has no effect, so it's dimmed */}
        <div className={state.enabled ? '' : 'cue-dim'}>
          <div className="cue-card">
            <div className="cue-card-title">Response delay</div>
            <DelaySlider
              label="Min"
              value={state.delay.min}
              onChange={(min) => update({ delay: { min, max: Math.max(min, state.delay.max) } })}
            />
            <DelaySlider
              label="Max"
              value={state.delay.max}
              onChange={(max) => update({ delay: { min: Math.min(state.delay.min, max), max } })}
            />
            <div className="cue-muted">Each mocked response waits a random time in this range.</div>
          </div>

          <div className="cue-card">
            <div className="cue-card-title">Clock</div>
            {/* The date-time field gets its own row — with seconds it doesn't fit next to the mode select */}
            <div className="cue-stack">
              <input
                className="cue-input cue-clock-input"
                type="datetime-local"
                step={1}
                value={time === null ? '' : toLocalInput(time.now)}
                onChange={(event) => {
                  const now = fromLocalInput(event.target.value)
                  update({ time: now === undefined ? null : { now, mode: time?.mode ?? 'frozen' } })
                }}
              />
              <div className="cue-row">
                <select
                  className="cue-select"
                  value={time?.mode ?? 'frozen'}
                  disabled={time === null}
                  onChange={(event) => {
                    if (time !== null) {
                      update({ time: { ...time, mode: event.target.value as 'frozen' | 'running' } })
                    }
                  }}
                >
                  <option value="frozen">Frozen</option>
                  <option value="running">Running</option>
                </select>
                <button
                  type="button"
                  className="cue-btn cue-btn-ghost"
                  disabled={time === null}
                  onClick={() => update({ time: null })}
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="cue-muted">Takes full effect when set before the app boots.</div>
          </div>

          <div className="cue-card">
            <label className="cue-row cue-spread">
              <span className="cue-card-title">Offline</span>
              <input
                className="cue-switch"
                type="checkbox"
                checked={state.network.offline}
                onChange={() => update({ network: { ...state.network, offline: !state.network.offline } })}
              />
            </label>
            <div className="cue-muted">API requests fail as if the network were down.</div>
          </div>

          <div className="cue-toolbar">
            <button type="button" className="cue-btn cue-btn-primary" onClick={() => setAll(true)}>
              Enable all
            </button>
            <button type="button" className="cue-btn cue-btn-secondary" onClick={() => setAll(false)}>
              Disable all
            </button>
          </div>

          <div className="cue-search">
            <input
              className="cue-input"
              type="search"
              value={keyword}
              placeholder="Search APIs (name, path)"
              onChange={(event) => setKeyword(event.target.value)}
            />
            {pathname !== undefined && (
              <label className="cue-muted">
                <input
                  className="cue-check"
                  type="checkbox"
                  checked={thisPageOnly}
                  onChange={() => setThisPageOnly((previous) => !previous)}
                />
                This page only
              </label>
            )}
          </div>

          {visible.length === 0 && (
            <div className="cue-empty">
              {thisPageOnly && pathname !== undefined
                ? `No mocked APIs on ${pathname}. Turn off "This page only" to see all.`
                : 'No matching APIs.'}
            </div>
          )}

          {groups.map((group) => (
            <div key={group.title} className="cue-group">
              <div className="cue-group-head">
                <span className="cue-group-title">{group.title}</span>
                <span className="cue-group-count">{group.entries.length}</span>
              </div>
              <div className="cue-list">
                {group.entries.map(([id, entry]) => {
                  const setting = state.api[id]
                  const on = setting?.enabled === true
                  return (
                    <div key={id} className="cue-item">
                      <div className="cue-row cue-spread">
                        <div className="cue-item-main">
                          <div className="cue-item-label">{entry.label}</div>
                          <div className="cue-item-path">
                            <span className="cue-method">{entry.method}</span>
                            {entry.path}
                          </div>
                        </div>
                        <label className="cue-item-side">
                          <span className="cue-item-status">
                            {state.enabled && on ? 'Mocked' : 'Real server'}
                          </span>
                          <input
                            className="cue-switch"
                            type="checkbox"
                            aria-label={`Mock ${entry.label}`}
                            checked={on}
                            onChange={() => update({ api: { [id]: { enabled: !on } } })}
                          />
                        </label>
                      </div>
                      {entry.scenarios !== undefined && (
                        <select
                          className="cue-select"
                          value={setting?.scenario ?? entry.scenarios[0]?.value ?? ''}
                          disabled={!on}
                          onChange={(event) => {
                            cuesheet.select(id, event.target.value)
                            onChange?.()
                          }}
                        >
                          {entry.scenarios.map((scenario) => (
                            <option key={scenario.value} value={scenario.value}>
                              {scenario.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="cue-group" style={{ marginTop: 16 }}>
          <div className="cue-group-head">
            <span className="cue-group-title">Requests</span>
            <span className="cue-group-count">{records.length}</span>
            <button
              type="button"
              className="cue-btn cue-btn-ghost"
              style={{ marginLeft: 'auto' }}
              disabled={records.length === 0}
              onClick={() => cuesheet.clearRecords()}
            >
              Clear
            </button>
          </div>
          {records.length === 0 ? (
            <div className="cue-muted">Requests answered by cuesheet show up here.</div>
          ) : (
            <div className="cue-records">
              {[...records].reverse().map((record) => (
                <div
                  key={record.requestId}
                  className="cue-record"
                  data-failed={record.status === 0 || record.status >= 400}
                  title={record.scenario ?? record.handlerId ?? record.error ?? ''}
                >
                  <span className="cue-method">{record.method}</span>
                  <span className="cue-record-path">{record.path}</span>
                  <span className="cue-record-status">{record.status === 0 ? 'ERR' : record.status}</span>
                  <span className="cue-record-time">{record.durationMs}ms</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* On/off and URL copy are pinned to the bottom so they're always visible regardless of scrolling */}
      <div className="cue-foot">
        <label className="cue-row">
          <input
            className="cue-switch"
            type="checkbox"
            aria-label="cuesheet on/off"
            checked={state.enabled}
            onChange={() => update({ enabled: !state.enabled })}
          />
          <span className="cue-foot-label">cuesheet</span>
          <span className="cue-foot-state" data-on={state.enabled}>
            {state.enabled ? 'On' : 'Off'}
          </span>
        </label>
        <CopyUrlButton cuesheet={cuesheet} />
      </div>
    </>
  )
}

/** One delay slider row. 0–5 s in 50 ms steps */
function DelaySlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (ms: number) => void
}) {
  return (
    <label className="cue-slider">
      <span className="cue-slider-label">{label}</span>
      <input
        type="range"
        min={0}
        max={5000}
        step={50}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="cue-slider-value">{value}ms</span>
    </label>
  )
}
