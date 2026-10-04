# CR-2. Tell the user when a coupon was already used

## Background

Tapping a coupon that was already used on another device only says "Couldn't redeem the coupon".
The server now answers **409** in that case (already deployed on the backend).

```http
POST /coupons/:id/redeem
409 Conflict
{ "code": "ALREADY_USED", "message": "This coupon has already been used" }
```

## Requirements

1. On 409, show `This coupon has already been used`. The only 409 this API returns is `ALREADY_USED`,
   so checking the status code is enough.
2. Then **reload the coupon list** so the screen matches the server.
3. Other failures keep showing `Couldn't redeem the coupon`.
4. **Add an `Already used` scenario to the `redeemCoupon` handler** so the 409 above can be reproduced
   with the mock.

## Acceptance criteria

| Enter with (`?cue=`) | Action | Expect |
|---|---|---|
| `on` | — | `redeemCoupon` has an `Already used` scenario |
| `on,redeemCoupon:Already used` | Redeem `Welcome discount` | Shows `This coupon has already been used`, then `GET /coupons` is requested again |
| `on,redeemCoupon:Server error` | Redeem `Welcome discount` | Shows `Couldn't redeem the coupon` (unchanged) |

## Verify

```bash
pnpm test:cr cr-2
```
