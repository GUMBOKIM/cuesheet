import { type CueHandler, HttpResponse, http } from 'cuesheet'
import { coupons, manyCoupons } from '../fixtures'

export default {
  id: 'redeemCoupon',
  label: 'Redeem coupon',
  path: '/coupons/:id/redeem',
  handler: [
    {
      scenario: 'Success',
      handler: http.post('/coupons/:id/redeem', ({ params }) => {
        // Any coupon a list scenario can show, so Redeem works whichever list is selected
        const coupon = [...coupons, ...manyCoupons].find((candidate) => candidate.id === params.id)
        if (coupon === undefined) {
          return HttpResponse.json({ message: 'Coupon not found' }, { status: 404 })
        }
        return HttpResponse.json({ ...coupon, used: true })
      }),
    },
    {
      // Used on another device. The only 409 this API returns
      scenario: 'Already used',
      handler: http.post('/coupons/:id/redeem', () =>
        HttpResponse.json(
          { code: 'ALREADY_USED', message: 'This coupon has already been used' },
          { status: 409 },
        ),
      ),
    },
    {
      scenario: 'Server error',
      handler: http.post('/coupons/:id/redeem', () =>
        HttpResponse.json({ message: 'Temporary error' }, { status: 500 }),
      ),
    },
  ],
} satisfies CueHandler
