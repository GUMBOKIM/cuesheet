'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCoupons, redeemCoupon } from '@/api'
import { CouponItem } from '@/components/CouponItem'
import { useCuesheet } from '@/cuesheet/CuesheetProvider'
import type { Coupon } from '@/types'

const ORDER_ID = 'A-1001'

type Load<T> = { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; message: string }

/**
 * The coupon list is loaded in the browser (Client Component). cuesheet intercepts the browser's
 * fetch / XHR, so APIs called by the server from a Server Component don't get mock responses.
 */
export default function CouponsPage() {
  const cuesheet = useCuesheet()
  const [coupons, setCoupons] = useState<Load<Coupon[]>>({ status: 'loading' })
  const [notice, setNotice] = useState<string | null>(null)

  const pending = useRef<AbortController | null>(null)

  // A new load cancels the one in flight — otherwise a slow response from before a scenario switch
  // could arrive last and put the old screen back
  const load = useCallback(() => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setCoupons({ status: 'loading' })
    // Check on both paths: a load aborted after its response arrived can still finish reading the body
    getCoupons(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setCoupons({ status: 'ok', data })
        }
      })
      .catch((cause: Error) => {
        if (!controller.signal.aborted) {
          setCoupons({ status: 'error', message: cause.message })
        }
      })
  }, [])

  // Reload whenever the state changes — from the panel, the URL or `window.__cuesheet__`
  useEffect(() => {
    load()
    const unsubscribe = cuesheet?.subscribe(load)
    return () => {
      unsubscribe?.()
      pending.current?.abort()
    }
  }, [cuesheet, load])

  async function redeem(coupon: Coupon) {
    setNotice(null)
    try {
      const updated = await redeemCoupon(coupon.id)
      setCoupons((current) =>
        current.status === 'ok'
          ? { ...current, data: current.data.map((item) => (item.id === updated.id ? updated : item)) }
          : current,
      )
      setNotice(`Redeemed '${coupon.name}'`)
    } catch {
      setNotice("Couldn't redeem the coupon")
    }
  }

  return (
    <main>
      <h1>Coupons</h1>
      <p className="muted">Pick a coupon for order #{ORDER_ID}</p>

      {notice !== null && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section>
        {coupons.status === 'loading' && <p className="skeleton">Loading…</p>}
        {coupons.status === 'error' && (
          <p className="error" role="alert">
            Couldn't load coupons ({coupons.message})
          </p>
        )}
        {coupons.status === 'ok' && coupons.data.length === 0 && (
          <p className="empty">No coupons available</p>
        )}
        {coupons.status === 'ok' && coupons.data.length > 0 && (
          <ul className="coupons">
            {coupons.data.map((coupon) => (
              <CouponItem key={coupon.id} coupon={coupon} onRedeem={redeem} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
