import type { Cuesheet } from './createCuesheet'

export const DEFAULT_GLOBAL_KEY = '__cuesheet__'

/**
 * Installs cuesheet on the global object. Does nothing outside the browser.
 *
 * This is the channel that lets tools running in the browser context (Playwright
 * `page.evaluate`, Puppeteer, the console) read and write state without going through the app bundle.
 *
 * ```ts
 * await page.evaluate(() => window.__cuesheet__?.select('getBusinesses', 'Empty'))
 * ```
 */
export function exposeGlobal(cuesheet: Cuesheet, key: string = DEFAULT_GLOBAL_KEY): void {
  if (typeof window === 'undefined') {
    return
  }
  ;(window as unknown as Record<string, unknown>)[key] = cuesheet
}
