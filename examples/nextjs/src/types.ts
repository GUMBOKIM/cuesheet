export interface Coupon {
  id: string
  name: string
  /** Discount text shown as-is (e.g. '$5 off', '10% off') */
  discount: string
  /** Expiry time, ISO 8601 */
  expiresAt: string
  used: boolean
}
