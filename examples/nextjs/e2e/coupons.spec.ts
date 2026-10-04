import { expect, test } from '@playwright/test'
import { clearRecords, enter, lastRequest, select } from './cue'

/** Checks that Next.js is driven the same way as the React (Vite) example */

test('shows the coupon list', async ({ page }) => {
  await enter(page, 'on')
  await expect(page.getByTestId('coupon-welcome')).toContainText('Welcome discount')
})

test('enters with a scenario from ?cue=', async ({ page }) => {
  await enter(page, 'on,getCoupons:Empty')
  await expect(page.getByText('No coupons available')).toBeVisible()
})

test('follows a scenario change after entering', async ({ page }) => {
  await enter(page, 'on')
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
  await select(page, 'getCoupons', 'Server error')
  // Next.js adds a route announcer with role=alert to every page, so look inside main
  await expect(page.locator('main').getByRole('alert')).toContainText("Couldn't load coupons")
})

test('applies the clock condition', async ({ page }) => {
  await enter(page, 'on,time:2026-01-15T09:00:00Z')
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
  expect(await page.evaluate(() => new Date().toISOString())).toBe('2026-01-15T09:00:00.000Z')
})

test('reads request records', async ({ page }) => {
  await enter(page, 'on')
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
  await clearRecords(page)
  await page.getByTestId('coupon-welcome').getByRole('button', { name: 'Redeem' }).click()
  const request = await lastRequest(page, { handlerId: 'redeemCoupon' })
  expect(request.path).toBe('/coupons/welcome/redeem')
})
