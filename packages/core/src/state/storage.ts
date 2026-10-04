/**
 * Where state is persisted. Kept apart from the state logic so swapping the store touches one place only.
 *
 * The default is `localStorage`. The interface is deliberately wider than that: both methods may return a
 * promise, so a store backed by IndexedDB, a real database or an HTTP API fits without changing this contract.
 * An asynchronous read can't answer before the app boots, so state starts from the defaults and is replaced
 * once the read resolves (see `createStateStore`)
 */

type MaybePromise<T> = T | Promise<T>

/**
 * State storage. `localStorage` and `sessionStorage` satisfy it as they are; anything else only has to
 * read and write a string under a key, synchronously or not
 */
export interface CueStorage {
  getItem(key: string): MaybePromise<string | null>
  setItem(key: string, value: string): MaybePromise<void>
}

/** The key cuesheet reads and writes. Everything an instance persists lives under this one key */
export const STATE_KEY = 'cuesheet:state'

/** In-memory storage used when none is given. For SSR and tests */
export function createMemoryStorage(): CueStorage {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

/**
 * The store an instance actually uses: the one that was given, or memory. Resolved once, so everything that
 * persists something — the state itself, the panel's own keys — goes through the same object
 */
export function resolveStorage(storage: CueStorage | undefined): CueStorage {
  return storage ?? createMemoryStorage()
}

export function isPromise<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof (value as Promise<T>)?.then === 'function'
}
