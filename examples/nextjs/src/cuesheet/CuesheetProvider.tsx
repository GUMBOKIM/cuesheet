'use client'

import type { Cuesheet } from 'cuesheet'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

const CuesheetContext = createContext<Cuesheet | null>(null)

/** The cuesheet instance in development, otherwise null */
export function useCuesheet(): Cuesheet | null {
  return useContext(CuesheetContext)
}

/**
 * Turns cuesheet on in development only. In production builds this branch is removed entirely, so no
 * cuesheet code ends up in the bundle.
 *
 * Write `process.env.NODE_ENV` **directly** in the condition instead of storing it in a variable.
 * webpack does not constant-fold local variables, so an `import()` after `if (!ENABLED) return` still
 * becomes a chunk and ships (Turbopack removes it, but don't rely on the bundler).
 *
 * Children are not rendered until it is on — if the first request went out before interception, or
 * the screen read the date before the clock was set, the `?cue=` state would not be reproduced. The
 * price: during development the server-rendered HTML is empty.
 *
 * If loading it fails (a broken handler file, a chunk that won't load), the app is rendered without
 * cuesheet instead of staying blank forever, and the reason goes to the console.
 */
export function CuesheetProvider({ children }: { children: ReactNode }) {
  const [cuesheet, setCuesheet] = useState<Cuesheet | null>(null)
  const [Panel, setPanel] = useState<typeof import('@cuesheet/react').CuesheetPanel | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      let cancelled = false
      void Promise.all([import('./instance'), import('@cuesheet/react')])
        .then(([{ cuesheet: instance }, { CuesheetPanel }]) => {
          if (cancelled) {
            return
          }
          instance.applyUrlParams()
          instance.start()
          setPanel(() => CuesheetPanel)
          setCuesheet(instance)
        })
        .catch((cause: unknown) => {
          if (cancelled) {
            return
          }
          console.error("[cuesheet] Couldn't load; running the app without it.", cause)
          setFailed(true)
        })
      return () => {
        cancelled = true
      }
    }
    return undefined
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return children
  }
  if (failed) {
    return children
  }
  if (cuesheet === null || Panel === null) {
    return null
  }
  return (
    <CuesheetContext.Provider value={cuesheet}>
      {children}
      <Panel cuesheet={cuesheet} />
    </CuesheetContext.Provider>
  )
}
