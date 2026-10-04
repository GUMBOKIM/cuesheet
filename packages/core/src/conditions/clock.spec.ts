import { afterEach, describe, expect, it, vi } from 'vitest'
import { installClock, type UninstallClock } from './clock'

let uninstall: UninstallClock | undefined

afterEach(() => {
  uninstall?.()
  uninstall = undefined
})

const TARGET = '2026-01-31T09:00:00.000Z'

describe('installClock', () => {
  it('frozen fixes the time', async () => {
    uninstall = installClock({ now: TARGET, mode: 'frozen' })
    const first = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(first).toBe(Date.parse(TARGET))
    expect(Date.now()).toBe(first)
  })

  it('changes only argument-less new Date() and leaves explicit times alone', () => {
    uninstall = installClock({ now: TARGET, mode: 'frozen' })
    expect(new Date().toISOString()).toBe(TARGET)
    expect(new Date('2020-05-05T00:00:00.000Z').toISOString()).toBe('2020-05-05T00:00:00.000Z')
  })

  it('running advances from the reference time', async () => {
    uninstall = installClock({ now: TARGET, mode: 'running' })
    const first = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 25))
    const second = Date.now()
    expect(first).toBeGreaterThanOrEqual(Date.parse(TARGET))
    expect(second).toBeGreaterThan(first)
  })

  it('returns to the real time when uninstalled', () => {
    const before = Date.now()
    const off = installClock({ now: TARGET, mode: 'frozen' })
    expect(Date.now()).toBe(Date.parse(TARGET))
    off()
    expect(Date.now()).toBeGreaterThanOrEqual(before)
  })

  it('ignores an unparseable time', () => {
    const real = Date.now()
    uninstall = installClock({ now: 'not-a-date', mode: 'frozen' })
    expect(Date.now()).toBeGreaterThanOrEqual(real)
  })

  it('Date() called without new returns the virtual time string', () => {
    uninstall = installClock({ now: TARGET, mode: 'frozen' })
    expect(Date()).toBe(new Date(TARGET).toString())
  })

  it('Dates created before installation are still instanceof Date', () => {
    const before = new Date()
    uninstall = installClock({ now: TARGET, mode: 'frozen' })
    expect(before instanceof Date).toBe(true)
    expect(new Date() instanceof Date).toBe(true)
  })

  it('classes extending Date keep their own methods', () => {
    uninstall = installClock({ now: TARGET, mode: 'frozen' })
    class Day extends Date {
      label(): string {
        return this.toISOString().slice(0, 10)
      }
    }
    expect(new Day().label()).toBe('2026-01-31')
  })

  it('static methods come from the original Date', () => {
    uninstall = installClock({ now: TARGET, mode: 'frozen' })
    expect(Date.UTC(2026, 0, 1)).toBe(Date.parse('2026-01-01T00:00:00.000Z'))
  })
})

describe('several clocks at once', () => {
  const OTHER = '2030-06-01T00:00:00.000Z'

  it.each([
    ['first installed, first removed', [0, 1]],
    ['last installed, first removed', [1, 0]],
  ])('restores the real Date whatever the order (%s)', (_, order) => {
    const RealDate = globalThis.Date
    const clocks = [
      installClock({ now: TARGET, mode: 'frozen' }),
      installClock({ now: OTHER, mode: 'frozen' }),
    ]
    expect(new Date().toISOString()).toBe(OTHER)

    clocks[order[0] as number]?.()
    // The remaining clock shows through
    expect(new Date().toISOString()).toBe(order[0] === 0 ? OTHER : TARGET)
    clocks[order[1] as number]?.()
    expect(globalThis.Date).toBe(RealDate)
  })
})

it('leaves Date alone if something else replaced it after the clock was installed', () => {
  const RealDate = globalThis.Date
  const remove = installClock({ now: TARGET, mode: 'frozen' })
  vi.useFakeTimers()
  const faked = globalThis.Date
  try {
    remove()
    expect(globalThis.Date).toBe(faked)
  } finally {
    vi.useRealTimers()
    globalThis.Date = RealDate
  }
})
