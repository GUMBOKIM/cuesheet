# CR-1. Flag coupons that are about to expire

## Background

Support keeps hearing "I didn't know I had that coupon and it expired yesterday". Make coupons close
to expiry stand out, and stop expired coupons from being redeemed.

## Requirements

1. A coupon with **72 hours or less** until expiry gets an `Expiring soon` badge.
2. A coupon is expired **from its expiry instant on**. Expired coupons show `Expired` and their
   **Redeem button is disabled** (the button is still named `Redeem`).
3. A used coupon keeps showing only `Used`, whether or not it has expired.
4. "Now" is the device clock (`Date.now()`).

## Acceptance criteria

`Weekend deal` (`weekend`) in the fixtures expires at `2026-01-31T23:59:59Z`.

| Enter with (`?cue=`) | Expect |
|---|---|
| `on,time:2026-01-29T09:00:00Z` | `Weekend deal` shows `Expiring soon`. `Welcome discount` does not. `First order shipping` shows `Expired` and its Redeem button is disabled |
| `on,time:2026-01-28T23:59:59Z` | Exactly 72 hours before — `Weekend deal` shows `Expiring soon` |
| `on,time:2026-01-28T23:59:58Z` | 72 hours and 1 second before — `Weekend deal` has no badge |
| `on,time:2026-01-31T23:59:59Z` | The expiry instant — `Weekend deal` shows `Expired`, Redeem disabled, no `Expiring soon` |
| `on,time:2026-02-01T00:00:00Z` | `Weekend deal` shows `Expired` and Redeem is disabled |

`time:` is a **frozen clock** by default, so second-level boundaries can be checked as-is (append
`/running` to let it tick).

## Verify

```bash
pnpm test:cr cr-1
```
