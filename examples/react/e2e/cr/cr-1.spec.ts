import { expect, type Page, test } from '@playwright/test'
import { enter } from '../cue'

/** requirements/CR-1.md */

const coupon = (page: Page, id: string) => page.getByTestId(`coupon-${id}`)
const redeem = (page: Page, id: string) => coupon(page, id).getByRole('button', { name: 'Redeem' })

test('expiring within 72 hours shows "Expiring soon"; expired shows "Expired" and cannot be redeemed', async ({
  page,
}) => {
  await enter(page, 'on,time:2026-01-29T09:00:00Z')

  await expect(coupon(page, 'weekend')).toContainText('Expiring soon')
  await expect(coupon(page, 'welcome')).toBeVisible()
  await expect(coupon(page, 'welcome')).not.toContainText('Expiring soon')

  await expect(coupon(page, 'shipping')).toContainText('Expired')
  await expect(redeem(page, 'shipping')).toBeDisabled()
})

test('exactly 72 hours before expiry is "Expiring soon"', async ({ page }) => {
  await enter(page, 'on,time:2026-01-28T23:59:59Z')
  await expect(coupon(page, 'weekend')).toContainText('Expiring soon')
})

test('72 hours and 1 second before expiry has no badge', async ({ page }) => {
  await enter(page, 'on,time:2026-01-28T23:59:58Z')
  await expect(coupon(page, 'weekend')).toBeVisible()
  await expect(coupon(page, 'weekend')).not.toContainText('Expiring soon')
})

test('the expiry instant itself is "Expired"', async ({ page }) => {
  await enter(page, 'on,time:2026-01-31T23:59:59Z')
  await expect(coupon(page, 'weekend')).toContainText('Expired')
  await expect(coupon(page, 'weekend')).not.toContainText('Expiring soon')
  await expect(redeem(page, 'weekend')).toBeDisabled()
})

test('after the expiry time it is "Expired"', async ({ page }) => {
  await enter(page, 'on,time:2026-02-01T00:00:00Z')
  await expect(coupon(page, 'weekend')).toContainText('Expired')
  await expect(redeem(page, 'weekend')).toBeDisabled()
})

test('a used coupon only shows "Used"', async ({ page }) => {
  await enter(page, 'on,time:2026-01-29T09:00:00Z')
  await expect(coupon(page, 'birthday')).toContainText('Used')
  await expect(coupon(page, 'birthday')).not.toContainText('Expired')
})
