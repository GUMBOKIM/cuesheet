import type { CueStorage } from 'cuesheet'

/** Key that remembers whether the panel is open. It stays open across reloads */
export const PANEL_OPEN_KEY = 'cuesheet:panel-open'

/**
 * Remembering the open state is a convenience, so it goes through the store the instance already uses
 * (`cuesheet.storage`) rather than reaching for `localStorage` on its own — one store, injected in one place.
 *
 * Where the store is denied (a sandboxed iframe, blocked site data) or full, the panel still works and simply
 * forgets. A store that answers asynchronously is awaited by the caller, so IndexedDB remembers it too
 */
export function readOpen(storage: CueStorage): Promise<boolean> {
  try {
    return Promise.resolve(storage.getItem(PANEL_OPEN_KEY))
      .then((value) => value === 'true')
      .catch(() => false)
  } catch {
    return Promise.resolve(false)
  }
}

export function writeOpen(storage: CueStorage, open: boolean): void {
  try {
    const written = storage.setItem(PANEL_OPEN_KEY, String(open))
    if (typeof (written as Promise<void> | void)?.then === 'function') {
      void (written as Promise<void>).catch(() => undefined)
    }
  } catch {
    // Not remembered; see readOpen
  }
}
