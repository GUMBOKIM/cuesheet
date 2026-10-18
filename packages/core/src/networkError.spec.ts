import { HttpResponse, http } from 'msw'
import { afterEach, expect, it } from 'vitest'
import { type Cuesheet, createCuesheet } from './createCuesheet'

let cuesheet: Cuesheet | undefined
afterEach(() => cuesheet?.stop())

it('HttpResponse.error() in a scenario makes fetch reject like a network error', async () => {
  cuesheet = createCuesheet({
    handlers: [
      {
        id: 'redeem',
        label: 'Redeem',
        path: '/redeem',
        handler: [{ scenario: 'Network error', handler: http.post('/redeem', () => HttpResponse.error()) }],
      },
    ],
    defaultEnabled: true,
    log: false,
  })
  cuesheet.start()
  const recorded = cuesheet.waitForRequest({ handlerId: 'redeem' })
  const failure = await fetch('/redeem', { method: 'POST' }).then(
    () => undefined,
    (cause: unknown) => cause,
  )
  expect(failure).toBeInstanceOf(TypeError)
  await expect(recorded).resolves.toMatchObject({ status: 0 })
  // Recorded as a failure, so a test waiting on the error path can find it
  expect(cuesheet.getRecords({ handlerId: 'redeem', failed: true })).toHaveLength(1)
  expect(cuesheet.getRecords({ handlerId: 'redeem', failed: false })).toHaveLength(0)
})

it('offline waits out the delay before failing, like a connection that hangs then drops', async () => {
  cuesheet = createCuesheet({
    handlers: [
      {
        id: 'getBusinesses',
        label: 'Business list',
        path: '/businesses',
        handler: http.get('/businesses', () => HttpResponse.json([])),
      },
    ],
    defaultEnabled: true,
    log: false,
  })
  cuesheet.start()
  cuesheet.patch({ network: { offline: true }, delay: { min: 120, max: 120 } })

  const startedAt = performance.now()
  const failure = await fetch('/businesses').then(
    () => undefined,
    (cause: unknown) => cause,
  )
  // Without the wait a screen never shows its loading state, so there is nothing to look at between the
  // click and the error — the one thing offline is usually turned on to see
  expect(performance.now() - startedAt).toBeGreaterThanOrEqual(100)
  expect(failure).toBeInstanceOf(TypeError)
})
