/**
 * Compile-time checks for patch() and record matchers against the generated types (src/cuesheet-env.d.ts). `pnpm typecheck` runs
 * them; Playwright doesn't, since this isn't a spec file
 */
import type { ApiPatch, CuePatch, RecordMatcher } from 'cuesheet'

export const valid: CuePatch = {
  api: { getCoupons: { scenario: 'Empty' }, redeemCoupon: { enabled: false } },
}

// @ts-expect-error a typo in a scenario name fails type checking, as it does for select()
export const typo: CuePatch = { api: { getCoupons: { scenario: 'Emtpy' } } }

// @ts-expect-error an unknown handler id fails too
export const unknownId: CuePatch = { api: { getCupons: { enabled: false } } }

// @ts-expect-error another handler's scenario isn't accepted
export const crossed: CuePatch = { api: { redeemCoupon: { scenario: 'Empty' } } }

// An id known only at runtime (a custom UI) goes through a cast; a wrong name is then a console warning
const id: string = 'getCoupons'
export const dynamic: CuePatch = { api: { [id]: { scenario: 'Empty' } } as ApiPatch }

export const matcher: RecordMatcher = { handlerId: 'getCoupons', scenario: 'Empty' }

// @ts-expect-error with a handlerId, scenario takes only that handler's scenarios
export const otherHandlersScenario: RecordMatcher = { handlerId: 'getCoupons', scenario: 'Success' }

export const anyHandlersScenario: RecordMatcher = { scenario: 'Success' }
