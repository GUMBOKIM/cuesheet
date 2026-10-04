import { expect, test } from '@playwright/test'
import { clearRecords, enter, lastRequest, patch, select } from '../cue'

test('shows the coupon list', async ({ page }) => {
  await enter(page, 'on')
  await expect(page.getByTestId('coupon-welcome')).toContainText('Welcome discount')
  await expect(page.getByTestId('coupon-birthday')).toContainText('Used')
})

test('shows an empty state when there are no coupons', async ({ page }) => {
  await enter(page, 'on,getCoupons:Empty')
  await expect(page.getByText('No coupons available')).toBeVisible()
})

test('shows an error when the list fails to load', async ({ page }) => {
  await enter(page, 'on,getCoupons:Server error')
  await expect(page.getByRole('alert')).toContainText("Couldn't load coupons")
})

test('follows scenario changes', async ({ page }) => {
  await enter(page, 'on')
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
  await select(page, 'getCoupons', 'Empty')
  await expect(page.getByText('No coupons available')).toBeVisible()
})

test('redeems a coupon', async ({ page }) => {
  await enter(page, 'on')
  await clearRecords(page)
  await page.getByTestId('coupon-welcome').getByRole('button', { name: 'Redeem' }).click()

  await expect(page.getByRole('status')).toHaveText("Redeemed 'Welcome discount'")
  await expect(page.getByTestId('coupon-welcome')).toContainText('Used')

  const request = await lastRequest(page, { handlerId: 'redeemCoupon' })
  expect(request.method).toBe('POST')
  expect(request.path).toBe('/coupons/welcome/redeem')
})

test('tells the user when redeeming fails', async ({ page }) => {
  await enter(page, 'on,redeemCoupon:Server error')
  await page.getByTestId('coupon-welcome').getByRole('button', { name: 'Redeem' }).click()
  await expect(page.getByRole('status')).toHaveText("Couldn't redeem the coupon")
})

test('redeems a coupon from the long list', async ({ page }) => {
  await enter(page, 'on,getCoupons:Many')
  await page.getByTestId('coupon-bulk-2').getByRole('button', { name: 'Redeem' }).click()
  await expect(page.getByRole('status')).toHaveText("Redeemed 'Bulk coupon 2'")
})

test('a slow load from before a scenario switch does not come back', async ({ page }) => {
  await enter(page, 'on,delay:1500')
  // While the first (slow) load is still in flight, drop the delay and switch — the new load answers first
  await patch(page, { delay: { min: 0, max: 0 } })
  await select(page, 'getCoupons', 'Empty')
  await expect(page.getByText('No coupons available')).toBeVisible()
  // Past the point where the first load would have answered
  await page.waitForTimeout(2000)
  await expect(page.getByText('No coupons available')).toBeVisible()
  await expect(page.getByTestId('coupon-welcome')).toHaveCount(0)
})
