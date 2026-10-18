// Handler ids and scenario names, so type checking catches a select() typo.
// Written by hand: update it when a handler file adds or renames a scenario.
// For agents: to drive these handlers (scenarios, clock, offline, request records),
// read node_modules/cuesheet/AGENTS.md.
import 'cuesheet'

declare module 'cuesheet' {
  interface CueRegistry {
    "getCoupons": "OK" | "Empty" | "One" | "Many" | "Server error"
    "redeemCoupon": "Success" | "Already used" | "Server error"
  }
}
