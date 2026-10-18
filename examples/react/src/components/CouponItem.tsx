import type { Coupon } from '../types'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

/** How close to expiry a coupon gets the "Expiring soon" badge, inclusive */
const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000

interface CouponItemProps {
  coupon: Coupon
  onRedeem(coupon: Coupon): void
}

export function CouponItem({ coupon, onRedeem }: CouponItemProps) {
  // Read while rendering, not kept in state — the list re-renders when it reloads. A coupon is expired
  // from its expiry instant on
  const remaining = new Date(coupon.expiresAt).getTime() - Date.now()
  const expired = remaining <= 0
  const expiringSoon = !expired && remaining <= EXPIRING_SOON_MS

  return (
    <li className="coupon" data-testid={`coupon-${coupon.id}`}>
      <div>
        <strong>{coupon.name}</strong> <span className="discount">{coupon.discount}</span>
        {!coupon.used && expiringSoon && <span className="tag warning">Expiring soon</span>}
        <p className="muted">Expires {dateFormat.format(new Date(coupon.expiresAt))}</p>
      </div>
      {coupon.used ? (
        <span className="tag">Used</span>
      ) : (
        <div className="actions">
          {expired && <span className="tag">Expired</span>}
          <button type="button" disabled={expired} onClick={() => onRedeem(coupon)}>
            Redeem
          </button>
        </div>
      )}
    </li>
  )
}
