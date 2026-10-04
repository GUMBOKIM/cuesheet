import { expect, test } from '@playwright/test'
import { clearRecords, enter, lastRequest } from '../cue'

/** requirements/CR-3.md */

test('sends the order id when redeeming', async ({ page }) => {
  await enter(page, 'on')
  await expect(page.getByTestId('coupon-welcome')).toBeVisible()
  await clearRecords(page)

  await page.getByTestId('coupon-welcome').getByRole('button', { name: 'Redeem' }).click()

  const request = await lastRequest(page, { handlerId: 'redeemCoupon' })
  expect(request.requestBody).toEqual({ orderId: 'A-1001' })
  await expect(page.getByRole('status')).toHaveText("Redeemed 'Welcome discount'")
})
