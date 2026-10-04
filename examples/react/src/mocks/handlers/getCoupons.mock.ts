import { type CueHandler, HttpResponse, http } from 'cuesheet'
import { coupons, manyCoupons, oneCoupon } from '../fixtures'

export default {
  id: 'getCoupons',
  label: 'Coupon list',
  path: '/coupons',
  handler: [
    { scenario: 'OK', handler: http.get('/coupons', () => HttpResponse.json(coupons)) },
    { scenario: 'Empty', handler: http.get('/coupons', () => HttpResponse.json([])) },
    { scenario: 'One', handler: http.get('/coupons', () => HttpResponse.json(oneCoupon)) },
    { scenario: 'Many', handler: http.get('/coupons', () => HttpResponse.json(manyCoupons)) },
    {
      scenario: 'Server error',
      handler: http.get('/coupons', () => HttpResponse.json({ message: 'Temporary error' }, { status: 500 })),
    },
  ],
} satisfies CueHandler
