import { expect, type Page } from '@playwright/test'
import type { CuePatch, CueRecord, HandlerId, RecordMatcher, SelectArgs } from 'cuesheet'

/**
 * Thin helpers to drive cuesheet from tests. Everything goes through `window.__cuesheet__` —
 * the same door an agent uses when it drives the browser directly.
 */

/**
 * "Today" for the tests — a day on which every fixture coupon is still valid.
 * Without a pinned clock, coupons expire one by one as real time passes and the tests break some day.
 */
export const TODAY = '2026-01-15T09:00:00Z'

/**
 * Opens the app in a `?cue=` state. The clock must be set before the app reads the date, so this is
 * the most reliable way. Without a `time:` item the clock is pinned to {@link TODAY}.
 */
export async function enter(page: Page, cue: string): Promise<void> {
  const pinned = cue.split(',').some((item) => item.startsWith('time:')) ? cue : `${cue},time:${TODAY}`
  await page.goto(`/?cue=${encodeURIComponent(pinned)}`)
  // The app loads cuesheet with a dynamic import, which can finish after the load event goto() waits for.
  // Until then window.__cuesheet__ is undefined and the helpers below would quietly do nothing
  await page.waitForFunction(() => window.__cuesheet__ !== undefined)
}

/** Handler ids and scenario names are typed by src/cuesheet-env.d.ts — typos fail type checking */
export async function select(page: Page, ...[id, scenario]: SelectArgs): Promise<void> {
  // Types are gone once we cross into the browser, so only cast here. The signature above does the checking
  await page.evaluate(
    ([handlerId, value]) => window.__cuesheet__?.select(...([handlerId, value] as SelectArgs)),
    [id, scenario] as [string, string],
  )
}

export async function patch(page: Page, partial: CuePatch): Promise<void> {
  await page.evaluate((value) => window.__cuesheet__?.patch(value), partial)
}

export async function clearRecords(page: Page): Promise<void> {
  await page.evaluate(() => window.__cuesheet__?.clearRecords())
}

export async function records(page: Page, matcher: RecordMatcher): Promise<CueRecord[]> {
  return await page.evaluate((value) => window.__cuesheet__?.getRecords(value) ?? [], matcher)
}

/** Waits until a matching request is recorded and returns the latest one */
export async function lastRequest(page: Page, matcher: RecordMatcher): Promise<CueRecord> {
  await expect.poll(async () => (await records(page, matcher)).length).toBeGreaterThan(0)
  const found = await records(page, matcher)
  return found[found.length - 1] as CueRecord
}

/** Scenario names a handler has. Used when a requirement needs a new scenario */
export async function scenariosOf(page: Page, id: HandlerId): Promise<string[]> {
  return await page.evaluate(
    (handlerId) =>
      window.__cuesheet__?.getCatalog()[handlerId]?.scenarios?.map((option) => option.value) ?? [],
    id,
  )
}
