import { useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from 'react'
import { CuesheetSettings, type CuesheetSettingsProps } from './CuesheetSettings'
import { readOpen, writeOpen } from './panelStorage'
import { injectStyles } from './styles'
import { useCueState } from './useCueState'

export interface CuesheetPanelProps extends CuesheetSettingsProps {
  /** Which bottom corner of the screen to show it in. Default 'left' */
  position?: 'left' | 'right' | undefined
}

/** Control panel floating in a corner of the screen. Mount exactly one at the app root */
export function CuesheetPanel({ position = 'left', ...settingsProps }: CuesheetPanelProps) {
  const { cuesheet } = settingsProps
  const state = useCueState(cuesheet)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  /** Whether the panel has been opened or closed by hand. A late restore must not undo that */
  const toggled = useRef(false)

  // Before the first paint, so the launcher never shows unstyled for a frame
  useInsertionEffect(() => {
    injectStyles()
  }, [])

  // Styles in the document don't reach inside a shadow root, so a panel rendered in one needs its own copy.
  // Not in the insertion effect above: the ref isn't attached that early
  useLayoutEffect(() => {
    const root = containerRef.current?.getRootNode()
    if (root instanceof ShadowRoot) {
      injectStyles(root)
    }
  }, [])

  // Restore the open state after mount — so it doesn't mismatch the SSR output. Awaited, since a store such
  // as IndexedDB answers a tick later; a sync store still resolves before the user could have clicked
  useEffect(() => {
    let cancelled = false
    void readOpen(cuesheet.storage).then((remembered) => {
      if (!cancelled && !toggled.current) {
        setOpen(remembered)
      }
    })
    return () => {
      cancelled = true
    }
  }, [cuesheet])

  // Clicking outside the panel closes it. The launcher button is inside the container, so it's handled as a toggle
  useEffect(() => {
    if (!open) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      // composedPath(), not event.target: from inside a shadow root the target seen here is the shadow host,
      // so every click in the panel would look like a click outside it
      const container = containerRef.current
      if (container !== null && !event.composedPath().includes(container)) {
        toggled.current = true
        setOpen(false)
        writeOpen(cuesheet.storage, false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, cuesheet])

  function toggle() {
    toggled.current = true
    // Written here rather than inside the updater: an updater must stay pure, and StrictMode runs it twice
    const next = !open
    setOpen(next)
    writeOpen(cuesheet.storage, next)
  }

  return (
    <div className="cue-root" data-position={position} ref={containerRef}>
      {open && (
        <div className="cue-panel">
          <div className="cue-head">
            <span className="cue-title">cuesheet</span>
            <button type="button" className="cue-btn cue-btn-ghost" onClick={toggle}>
              Close
            </button>
          </div>
          <CuesheetSettings {...settingsProps} />
        </div>
      )}
      <button type="button" className="cue-launcher" onClick={toggle} data-on={state.enabled}>
        cue
      </button>
    </div>
  )
}
