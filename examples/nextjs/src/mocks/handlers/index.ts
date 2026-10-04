import { collectHandlers } from 'cuesheet'
import * as getCoupons from './getCoupons.mock'
import * as redeemCoupon from './redeemCoupon.mock'

/**
 * Turbopack has no folder-level import like Vite's `import.meta.glob`, so the files are listed here.
 * Add a line when you create a new handler file.
 */
export const handlers = collectHandlers({
  './getCoupons.mock.ts': getCoupons,
  './redeemCoupon.mock.ts': redeemCoupon,
})
