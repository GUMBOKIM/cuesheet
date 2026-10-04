import { API } from './config'
import type { Coupon } from './types'

/**
 * The server answered, but with a failure status (4xx/5xx). When the server can't answer at all
 * (network error), fetch throws a TypeError, which is not wrapped in this class.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new ApiError(response.status, body.message ?? `${response.status}`)
  }
  return (await response.json()) as T
}

export function getCoupons(signal?: AbortSignal): Promise<Coupon[]> {
  return request<Coupon[]>('/coupons', signal === undefined ? undefined : { signal })
}

export function redeemCoupon(id: string): Promise<Coupon> {
  return request<Coupon>(`/coupons/${id}/redeem`, { method: 'POST' })
}
