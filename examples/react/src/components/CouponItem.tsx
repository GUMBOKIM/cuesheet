import type { Coupon } from '../types'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

interface CouponItemProps {
  coupon: Coupon
  onRedeem(coupon: Coupon): void
}

export function CouponItem({ coupon, onRedeem }: CouponItemProps) {
  return (
    <li className="coupon" data-testid={`coupon-${coupon.id}`}>
      <div>
        <strong>{coupon.name}</strong> <span className="discount">{coupon.discount}</span>
        <p className="muted">Expires {dateFormat.format(new Date(coupon.expiresAt))}</p>
      </div>
      {coupon.used ? (
        <span className="tag">Used</span>
      ) : (
        <button type="button" onClick={() => onRedeem(coupon)}>
          Redeem
        </button>
      )}
    </li>
  )
}
