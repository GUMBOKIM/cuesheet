import { collectHandlers, createCuesheet } from 'cuesheet'
import { API } from '../config'

/**
 * The cuesheet instance. main.tsx imports this file dynamically on the dev server only, so a production
 * build contains none of it — not cuesheet, not msw, not a single mock response.
 */
export const cuesheet = createCuesheet({
  baseUrl: API,
  handlers: collectHandlers(import.meta.glob('./handlers/*.mock.ts', { eager: true })),
  // Kept across reloads. Reading window.localStorage throws where storage is denied, and cuesheet then keeps the state in memory
  storage: (() => {
    try {
      return window.localStorage
    } catch {
      return undefined
    }
  })(),
  defaultEnabled: true,
})

// Applied before start() and before the app renders, so a ?cue= link covers the first request and the clock
cuesheet.applyUrlParams()
cuesheet.start()
