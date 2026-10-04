/** API response delay. Random between min and max for each request */
export interface DelayCondition {
  min: number
  max: number
}

/** The time the app should believe it is */
export interface TimeCondition {
  /** Reference time. An ISO 8601 string (e.g. '2026-01-31T09:00:00+09:00') */
  now: string
  /** frozen: time stands still. running: time advances in real time from the reference time */
  mode: 'frozen' | 'running'
}

/** Network state. Only an explicit on/off, no random failures — screens must be reproducible */
export interface NetworkCondition {
  /** When on, API requests fail with a network error instead of a response */
  offline: boolean
}

export { installClock } from './clock'
