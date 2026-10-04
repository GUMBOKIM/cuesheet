import { createCuesheet } from 'cuesheet'
import { API } from '../config'
import { handlers } from '../mocks/handlers'

/**
 * Loaded in the browser only (`CuesheetProvider` imports it dynamically).
 * There is no `window` during server rendering, and cuesheet does not intercept server-side fetches.
 */
export const cuesheet = createCuesheet({
  baseUrl: API,
  handlers,
  // Guarded so importing this file somewhere else by mistake (a Server Component, a Node test) doesn't crash
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  defaultEnabled: true,
})
