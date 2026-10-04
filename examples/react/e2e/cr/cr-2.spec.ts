import { expect, test } from '@playwright/test'
import { clearRecords, enter, lastRequest, scenariosOf } from '../cue'

/** requirements/CR-2.md */

test('redeemCoupon has an "Already used" scenario', async ({ page }) => {
  await enter(page, 'on')
  expect(await scenariosOf(page, 'redeemCoupon')).toContain('Already used')
})

test('on 409 it tells the user and reloads the list', async ({ page }) => {
  await enter(page, 'on,redeemCoupon:Already used')
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
  await clearRecords(page)

  await page.getByTestId('coupon-welcome').getByRole('button', { name: 'Redeem' }).click()

  await expect(page.getByRole('status')).toHaveText('This coupon has already been used')
  const redeem = await lastRequest(page, { handlerId: 'redeemCoupon' })
  expect(redeem.status).toBe(409)
  const refetch = await lastRequest(page, { handlerId: 'getCoupons' })
  expect(refetch.startedAt).toBeGreaterThan(redeem.startedAt)
})

test('other failures keep the existing message', async ({ page }) => {
  await enter(page, 'on,redeemCoupon:Server error')
  await page.getByTestId('coupon-welcome').getByRole('button', { name: 'Redeem' }).click()
  await expect(page.getByRole('status')).toHaveText("Couldn't redeem the coupon")
})
