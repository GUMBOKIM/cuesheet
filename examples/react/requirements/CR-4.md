# CR-4. Retry when the connection drops

## Background

Opening the coupon list on the subway shows "Couldn't load coupons (Failed to fetch)". It looks like
a server error, and users write in about it.

## Requirements

1. On a network error (the server could not answer), show `You're offline` and a `Retry` button.
2. `Retry` requests the list again.
3. When the server **does answer** with an error, keep showing `Couldn't load coupons`.

## Acceptance criteria

| Enter with (`?cue=`) | Action | Expect |
|---|---|---|
| `on,offline` | — | `You're offline` and a `Retry` button |
| `on,offline` | `Retry` | `GET /coupons` is requested again (and still fails) |
| `on,offline` | Go back online (`patch({ network: { offline: false } })`) | The coupon list shows up |
| `on,getCoupons:Server error` | — | `Couldn't load coupons`, and no `You're offline` |

## Verify

```bash
pnpm test:cr cr-4
```
