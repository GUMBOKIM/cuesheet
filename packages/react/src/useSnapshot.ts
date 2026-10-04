import { useCallback, useRef, useSyncExternalStore } from 'react'

/**
 * Connects a store that may return a new object on every read to `useSyncExternalStore`.
 *
 * `getRecords()` creates a new value on every call, so passing it straight through causes an infinite loop.
 * The snapshot is replaced only when a subscription notification arrives, keeping the reference stable. Snapshots are
 * kept per source (cuesheet instance), so switching to another instance reads that instance's value afresh.
 *
 * `read`, `listen` and `isSame` must be module-level functions that don't change between renders.
 */
export function useSnapshot<S, T>(
  source: S,
  read: (source: S) => T,
  listen: (source: S, onNext: (value: T) => void) => () => void,
  isSame: (left: T, right: T) => boolean,
): T {
  const snapshot = useRef<{ source: S; value: T } | undefined>(undefined)
  if (snapshot.current === undefined || snapshot.current.source !== source) {
    snapshot.current = { source, value: read(source) }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: read, listen and isSame are module-level functions, so they never change
  const subscribe = useCallback(
    (onChange: () => void) => {
      const unsubscribe = listen(source, (value) => {
        snapshot.current = { source, value }
        onChange()
      })
      // Catch up on changes made between render and subscription (e.g. in a layout effect) — no notification
      // reached this hook for them, so without this it would show the old value until the next change
      const latest = read(source)
      const current = snapshot.current
      if (current?.source === source && !isSame(current.value, latest)) {
        snapshot.current = { source, value: latest }
        onChange()
      }
      return unsubscribe
    },
    [source],
  )

  const getSnapshot = useCallback(() => (snapshot.current as { value: T }).value, [])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
