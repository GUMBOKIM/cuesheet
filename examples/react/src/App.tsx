import type { Cuesheet } from 'cuesheet'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getCoupons, redeemCoupon } from './api'
import { CouponItem } from './components/CouponItem'
import type { Coupon } from './types'

/** The order this screen applies a coupon to. Fixed, since this is an example */
export const ORDER_ID = 'A-1001'

type Load<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string }
  /** The server couldn't answer at all (network error) — unlike 'error', where it answered with a failure */
  | { status: 'offline' }

/**
 * The control panel, loaded on the dev server only. `import.meta.env.DEV` is false in `vite build`, so the
 * import is dropped and the production bundle carries no panel code
 */
const CuesheetPanel = import.meta.env.DEV
  ? lazy(() => import('@cuesheet/react').then((module) => ({ default: module.CuesheetPanel })))
  : undefined

/** `cuesheet` is undefined in production builds, where main.tsx never loads it */
export default function App({ cuesheet }: { cuesheet?: Cuesheet | undefined }) {
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
        if (controller.signal.aborted) {
          return
        }
        // fetch throws a TypeError when no response came back; an error status is an ApiError
        setCoupons(
          cause instanceof TypeError ? { status: 'offline' } : { status: 'error', message: cause.message },
        )
      })
  }, [])

  // Use subscribe, not the panel's onChange — it catches changes from the panel, the URL and
  // `window.__cuesheet__` alike. In production builds cuesheet is undefined, so this does nothing.
  useEffect(() => {
    load()
    const unsubscribe = cuesheet?.subscribe(load)
    return () => {
      unsubscribe?.()
      pending.current?.abort()
    }
  }, [load, cuesheet])

  async function redeem(coupon: Coupon) {
    setNotice(null)
    try {
      const updated = await redeemCoupon(coupon.id, ORDER_ID)
      setCoupons((current) =>
        current.status === 'ok'
          ? { ...current, data: current.data.map((item) => (item.id === updated.id ? updated : item)) }
          : current,
      )
      setNotice(`Redeemed '${coupon.name}'`)
    } catch (cause) {
      // 409 is only ever ALREADY_USED: used on another device, so reload to match the server
      if (cause instanceof ApiError && cause.status === 409) {
        setNotice('This coupon has already been used')
        load()
        return
      }
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
        {coupons.status === 'offline' && (
          <div className="offline">
            <p className="error" role="alert">
              You're offline
            </p>
            <button type="button" onClick={load}>
              Retry
            </button>
          </div>
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

      {CuesheetPanel !== undefined && cuesheet !== undefined && (
        <Suspense fallback={null}>
          <CuesheetPanel cuesheet={cuesheet} />
        </Suspense>
      )}
    </main>
  )
}
