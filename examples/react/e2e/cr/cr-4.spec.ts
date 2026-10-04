import { expect, test } from '@playwright/test'
import { clearRecords, enter, lastRequest, patch } from '../cue'

/** requirements/CR-4.md */

test('offline shows "You\'re offline" and a Retry button', async ({ page }) => {
  await enter(page, 'on,offline')
  await expect(page.getByRole('alert')).toContainText("You're offline")
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
})

test('Retry requests the list again', async ({ page }) => {
  await enter(page, 'on,offline')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await clearRecords(page)

  await page.getByRole('button', { name: 'Retry' }).click()

  // Requests cut by offline fail before a handler is chosen, so find them by path instead of id
  const retry = await lastRequest(page, { method: 'GET', path: '/coupons', failed: true })
  expect(retry.status).toBe(0)
})

test('the list shows up once back online', async ({ page }) => {
  await enter(page, 'on,offline')
  await expect(page.getByRole('alert')).toContainText("You're offline")
  await patch(page, { network: { offline: false } })
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
})

test('a server error response is not "offline"', async ({ page }) => {
  await enter(page, 'on,getCoupons:Server error')
  await expect(page.getByRole('alert')).toContainText("Couldn't load coupons")
  await expect(page.getByText("You're offline")).toHaveCount(0)
})
