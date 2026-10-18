import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Cuesheet, createCuesheet } from '../createCuesheet'
import type { CueHandler } from '../handler'
import { type CueRecord, createRecorder, matches } from '.'

const BASE_URL = 'https://api.example.com'

const handlers: CueHandler[] = [
  {
    id: 'getBusinesses',
    label: 'Business list',
    path: '/businesses',
    handler: [
      { scenario: 'OK', handler: http.get('/businesses', () => HttpResponse.json([{ id: 1 }])) },
      {
        scenario: 'Server error',
        handler: http.get('/businesses', () => HttpResponse.json({ m: 'x' }, { status: 500 })),
      },
    ],
  },
  {
    id: 'checkCard',
    label: 'Card check',
    path: '/cards/check',
    handler: http.post('/cards/check', () => HttpResponse.json({ valid: true })),
  },
]

let cuesheet: Cuesheet | undefined

function setup(record?: boolean | { limit?: number; bodies?: boolean }): Cuesheet {
  cuesheet = createCuesheet({
    handlers,
    baseUrl: BASE_URL,
    defaultEnabled: true,
    log: false,
    expose: false,
    ...(record === undefined ? {} : { record }),
  })
  cuesheet.start()
  return cuesheet
}

afterEach(() => {
  cuesheet?.stop()
  cuesheet = undefined
})

/**
 * Sends a request cuesheet answers (or fails) and waits for its record. A record lands once its bodies are
 * read — a moment after the app has the response — so reading records right after `await fetch()` would race
 */
async function send(path: string, init?: RequestInit): Promise<void> {
  const recorded = (cuesheet as Cuesheet).waitForRequest({})
  await fetch(`${BASE_URL}${path}`, init).catch(() => undefined)
  await recorded
}

describe('request records', () => {
  it('records answered requests along with the handler that handled them', async () => {
    const cue = setup()
    await send('/businesses')

    const [record] = cue.getRecords()
    expect(record).toMatchObject({
      method: 'GET',
      path: '/businesses',
      handlerId: 'getBusinesses',
      status: 200,
    })
    expect(record?.responseBody).toEqual([{ id: 1 }])
    expect(record?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('records the selected scenario', async () => {
    const cue = setup()
    cue.select('getBusinesses', 'Server error')
    await send('/businesses')

    expect(cue.getRecords()[0]).toMatchObject({ scenario: 'Server error', status: 500 })
  })

  it('records the request body', async () => {
    const cue = setup()
    await send('/cards/check', {
      method: 'POST',
      body: JSON.stringify({ cardNumber: '1234' }),
    })

    expect(cue.getRecords()[0]).toMatchObject({
      method: 'POST',
      handlerId: 'checkCard',
      requestBody: { cardNumber: '1234' },
    })
  })

  it('does not record bypassed requests', async () => {
    const cue = setup()
    cue.patch({ api: { getBusinesses: { enabled: false } } })
    await fetch(`${BASE_URL}/businesses`).catch(() => undefined)

    expect(cue.getRecords()).toEqual([])
  })

  it('filters by matcher', async () => {
    const cue = setup()
    await send('/businesses')
    await send('/cards/check', { method: 'POST', body: '{}' })

    expect(cue.getRecords({ handlerId: 'checkCard' })).toHaveLength(1)
    expect(cue.getRecords({ method: 'GET' })).toHaveLength(1)
    expect(cue.getRecords({ path: '/cards' })).toHaveLength(1)
    expect(cue.getRecords({ path: /^\/bus/ })).toHaveLength(1)
    expect(cue.getRecords({ status: 500 })).toHaveLength(0)
    expect(cue.getRecords()).toHaveLength(2)
  })

  it('drops the oldest records beyond limit', async () => {
    const cue = setup({ limit: 2 })
    await send('/businesses')
    await send('/businesses')
    await send('/cards/check', { method: 'POST', body: '{}' })

    const records = cue.getRecords()
    expect(records).toHaveLength(2)
    expect(records[1]?.handlerId).toBe('checkCard')
  })

  it('does not record bodies with bodies: false', async () => {
    const cue = setup({ bodies: false })
    await send('/businesses')

    const [record] = cue.getRecords()
    expect(record?.status).toBe(200)
    expect(record?.responseBody).toBeUndefined()
  })

  it('records nothing with record: false', async () => {
    const cue = setup(false)
    await (await fetch(`${BASE_URL}/businesses`)).json()

    expect(cue.getRecords()).toEqual([])
  })

  it('clearRecords empties the records', async () => {
    const cue = setup()
    await send('/businesses')
    expect(cue.getRecords()).toHaveLength(1)

    cue.clearRecords()
    expect(cue.getRecords()).toEqual([])
  })
})

describe('waitForRequest', () => {
  it('waits for an upcoming request', async () => {
    const cue = setup()
    const pending = cue.waitForRequest({ handlerId: 'checkCard' })
    // Even if other requests come first, only a matching one resolves it
    await fetch(`${BASE_URL}/businesses`)
    await fetch(`${BASE_URL}/cards/check`, { method: 'POST', body: '{}' })

    await expect(pending).resolves.toMatchObject({ handlerId: 'checkCard' })
  })

  it('ignores existing records', async () => {
    const cue = setup()
    await fetch(`${BASE_URL}/businesses`)

    await expect(cue.waitForRequest({ handlerId: 'getBusinesses' }, { timeout: 60 })).rejects.toThrow(
      /arrived within/,
    )
  })

  it('fails with the matcher when nothing arrives in time', async () => {
    const cue = setup()
    await expect(cue.waitForRequest({ handlerId: 'checkCard' }, { timeout: 60 })).rejects.toThrow(
      /handlerId=checkCard/,
    )
  })

  it('takes null options as no options', async () => {
    vi.useFakeTimers()
    try {
      const pending = createRecorder().waitFor({}, null as never)
      pending.catch(() => undefined)
      await vi.advanceTimersByTimeAsync(5000)
      await expect(pending).rejects.toThrow(/within 5000ms/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to the default, with a warning, for a timeout that is not a number of 0 or more', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const recorder = createRecorder()
      for (const timeout of [null, '5s', -1]) {
        const settled = vi.fn()
        const pending = recorder.waitFor({}, { timeout: timeout as number })
        pending.catch(settled)
        await vi.advanceTimersByTimeAsync(4999)
        expect(settled).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1)
        await expect(pending).rejects.toThrow(/within 5000ms/)
      }
      expect(warn).toHaveBeenCalledTimes(3)
    } finally {
      warn.mockRestore()
      vi.useRealTimers()
    }
  })

  // setTimeout reads Infinity (or anything past 2^31 - 1 ms) as 1 ms, so "wait with no limit" rejected at once
  it('caps a timeout that is too long instead of rejecting at once', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const recorder = createRecorder()
      const settled = vi.fn()
      const pending = recorder.waitFor({}, { timeout: Number.POSITIVE_INFINITY })
      pending.catch(settled)
      await vi.advanceTimersByTimeAsync(59_999)
      expect(settled).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await expect(pending).rejects.toThrow(/within 60000ms/)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('capped at 60000ms'))
    } finally {
      warn.mockRestore()
      vi.useRealTimers()
    }
  })
})

describe('offline', () => {
  it('API requests fail', async () => {
    const cue = setup()
    cue.patch({ network: { offline: true } })

    await expect(fetch(`${BASE_URL}/businesses`)).rejects.toThrow()
  })

  it('failures are recorded too', async () => {
    const cue = setup()
    cue.patch({ network: { offline: true } })
    await send('/businesses')

    const [record] = cue.getRecords()
    expect(record).toMatchObject({ method: 'GET', path: '/businesses', status: 0 })
    expect(record?.error).toBeTruthy()
    expect(cue.getRecords({ failed: true })).toHaveLength(1)
    expect(cue.getRecords({ failed: false })).toHaveLength(0)
  })

  it('also cuts off paths without a handler', async () => {
    const cue = setup()
    cue.patch({ network: { offline: true } })

    await send('/unknown')
    expect(cue.getRecords()[0]?.path).toBe('/unknown')
  })

  it('responds again when turned off', async () => {
    const cue = setup()
    cue.patch({ network: { offline: true } })
    await fetch(`${BASE_URL}/businesses`).catch(() => undefined)

    cue.patch({ network: { offline: false } })
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([{ id: 1 }])
  })
})

describe('matches', () => {
  it('a g-flag RegExp does not miss records due to lastIndex when filtering several', () => {
    const record = (path: string): CueRecord => ({
      requestId: path,
      method: 'GET',
      url: `https://x${path}`,
      path,
      status: 200,
      durationMs: 0,
      startedAt: 0,
    })
    const matcher = { path: /\/coupons/g }
    expect([record('/coupons'), record('/coupons/1')].filter((item) => matches(item, matcher))).toHaveLength(
      2,
    )
  })
})

describe('record scenario and limits', () => {
  it('names the default scenario when none was selected, and filters by scenario', async () => {
    const cue = setup()
    await send('/businesses')
    cue.select('getBusinesses', 'Server error')
    await send('/businesses')
    await send('/cards/check', { method: 'POST', body: '{}' })

    expect(cue.getRecords().map((record) => record.scenario)).toEqual(['OK', 'Server error', undefined])
    expect(cue.getRecords({ scenario: 'OK' })).toHaveLength(1)
  })

  it('limit 0 keeps no records but still resolves waiters', async () => {
    const cue = setup({ limit: 0 })
    const pending = cue.waitForRequest({ handlerId: 'getBusinesses' })
    await fetch(`${BASE_URL}/businesses`)
    await expect(pending).resolves.toMatchObject({ handlerId: 'getBusinesses' })
    expect(cue.getRecords()).toEqual([])
  })

  it('rejects a negative or fractional limit', () => {
    expect(() => setup({ limit: -1 })).toThrow(/record.limit/)
    expect(() => setup({ limit: 1.5 })).toThrow(/record.limit/)
  })
})

describe('record: false', () => {
  it('keeps no records, but waitForRequest() still resolves', async () => {
    const cue = setup(false)
    const pending = cue.waitForRequest({ handlerId: 'getBusinesses' }, { timeout: 1000 })
    await fetch(`${BASE_URL}/businesses`)
    await expect(pending).resolves.toMatchObject({ handlerId: 'getBusinesses' })
    expect(cue.getRecords()).toEqual([])
  })
})

describe('a subscriber that throws', () => {
  it('does not stop clearRecords(), and the ones after it still hear about it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const cue = setup()
    cue.subscribeRecords(() => {
      throw new Error('boom')
    })
    const seen: number[] = []
    cue.subscribeRecords((records) => seen.push(records.length))
    await fetch(`${BASE_URL}/businesses`)
    await vi.waitFor(() => expect(cue.getRecords()).toHaveLength(1))

    expect(() => cue.clearRecords()).not.toThrow()
    expect(cue.getRecords()).toEqual([])
    expect(seen.at(-1)).toBe(0)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('A record subscriber threw'),
      expect.anything(),
    )
    error.mockRestore()
  })
})

describe('waitForRequest() without a matcher', () => {
  it('resolves with the next record of any request', async () => {
    const cue = setup()
    const pending = cue.waitForRequest()
    await fetch(`${BASE_URL}/businesses`)
    await expect(pending).resolves.toMatchObject({ handlerId: 'getBusinesses' })
  })
})
