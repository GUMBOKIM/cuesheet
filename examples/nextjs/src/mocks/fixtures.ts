import type { Coupon } from '../types'

/**
 * Expiry dates are fixed. Screens that depend on the date are checked by moving "today" with
 * cuesheet's clock — if fixtures were computed from today, the tests would change every day.
 */
export const coupons: Coupon[] = [
  {
    id: 'welcome',
    name: 'Welcome discount',
    discount: '$5 off',
    expiresAt: '2026-02-28T23:59:59Z',
    used: false,
  },
  {
    id: 'weekend',
    name: 'Weekend deal',
    discount: '10% off',
    expiresAt: '2026-01-31T23:59:59Z',
    used: false,
  },
  {
    id: 'shipping',
    name: 'First order shipping',
    discount: 'Free shipping',
    expiresAt: '2026-01-20T23:59:59Z',
    used: false,
  },
  {
    id: 'birthday',
    name: 'Birthday gift',
    discount: '$3 off',
    expiresAt: '2026-03-15T23:59:59Z',
    used: true,
  },
]

/** A single coupon, for checking the list with one item */
export const oneCoupon: Coupon[] = coupons.slice(0, 1)

/** A long list, for checking scrolling and layout. All still valid on the tests' "today", every seventh one used */
export const manyCoupons: Coupon[] = Array.from({ length: 40 }, (_, index) => ({
  id: `bulk-${index + 1}`,
  name: `Bulk coupon ${index + 1}`,
  discount: `${(index % 9) + 1}% off`,
  expiresAt: '2026-06-30T23:59:59Z',
  used: index % 7 === 0,
}))
