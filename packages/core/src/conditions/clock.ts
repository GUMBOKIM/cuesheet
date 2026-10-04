import * as log from '../util/log'
import type { TimeCondition } from './index'

/** Uninstalls the clock, restoring the original Date */
export type UninstallClock = () => void

/**
 * Clocks currently installed, oldest first. With several instances (or tests) installing and uninstalling
 * in any order, the global always shows the newest remaining clock, and the real Date once none remain.
 * Capturing "whatever Date is installed now" per clock instead would restore another instance's fake clock
 */
const installed: DateConstructor[] = []
let realDate: DateConstructor | undefined

/**
 * Replaces the global `Date` with a virtual clock. Only `Date.now()` and argument-less `new Date()`
 * are affected; explicit times such as `new Date('2026-01-01')` are left alone.
 *
 * Timestamps already captured (e.g. read at module load) can't be changed retroactively,
 * so install it before the app boots for it to work as intended. Code holding the original `Date`
 * (a `const now = Date.now` or a `class X extends Date` evaluated before installation) and engine
 * internals such as argument-less `Intl.DateTimeFormat#format()` keep the real time.
 */
export function installClock(condition: TimeCondition): UninstallClock {
  if (installed.length === 0) {
    realDate = globalThis.Date
  }
  const RealDate = realDate as DateConstructor
  const target = RealDate.parse(condition.now)
  if (Number.isNaN(target)) {
    log.error(`Couldn't parse time '${condition.now}'; skipping the time condition`)
    return () => undefined
  }

  const installedAt = RealDate.now()
  const currentNow = (): number =>
    condition.mode === 'frozen' ? target : target + (RealDate.now() - installedAt)

  // Subclassing with `class` breaks two things: calling `Date()` without `new` becomes a TypeError,
  // and Dates created before installation fail `instanceof Date`. Wrapping in a function constructor
  // that reuses the original prototype preserves both behaviours
  function CueDate(...args: unknown[]): Date | string {
    if (new.target === undefined) {
      // `Date()` returns the current time as a string, regardless of arguments
      return new RealDate(currentNow()).toString()
    }
    // Passing new.target lets subclasses such as `class X extends Date` get their own prototype
    return Reflect.construct(RealDate, args.length === 0 ? [currentNow()] : args, new.target)
  }
  CueDate.prototype = RealDate.prototype
  // Static methods such as parse and UTC are inherited from the original Date; only now is replaced
  Object.setPrototypeOf(CueDate, RealDate)
  CueDate.now = currentNow

  const clock = CueDate as DateConstructor
  installed.push(clock)
  globalThis.Date = clock
  return () => {
    const index = installed.indexOf(clock)
    if (index < 0) {
      return
    }
    installed.splice(index, 1)
    // Only put something back if this clock is what's installed. If something else replaced Date since
    // (vi.useFakeTimers(), another library), it owns the global now and restores it itself
    if (globalThis.Date === clock) {
      globalThis.Date = installed.at(-1) ?? RealDate
    }
    if (installed.length === 0) {
      realDate = undefined
    }
  }
}
