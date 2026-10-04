# CR-3. Send the order id when redeeming

## Background

The server needs to know which order a coupon was used for, for settlement. The `redeem` API now
takes a request body (already deployed on the backend; without a body it answers 400).

```http
POST /coupons/:id/redeem
Content-Type: application/json

{ "orderId": "A-1001" }
```

## Requirements

1. When redeeming, send the order id of the current screen (`ORDER_ID`) as `orderId`.
2. The screen behaves the same as before.
3. (Optional) You may make the mock's `Success` scenario answer 400 without a body, like the real
   server. Then a missing body shows up on screen right away. Reading the body with `request.json()`
   inside a handler does not affect the recorded `requestBody`.

## Acceptance criteria

| Enter with (`?cue=`) | Action | Expect |
|---|---|---|
| `on` | Redeem `Welcome discount` | The recorded `redeemCoupon` request body is `{ "orderId": "A-1001" }` |

This change is invisible on screen. Check it with cuesheet's request records (`getRecords`).

## Verify

```bash
pnpm test:cr cr-3
```
