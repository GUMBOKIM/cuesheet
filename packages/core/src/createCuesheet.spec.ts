import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Cuesheet, createCuesheet } from './createCuesheet'
import type { CueHandler } from './handler'
import type { ApiPatch } from './state'

const BASE_URL = 'https://api.example.com'

const handlers: CueHandler[] = [
  {
    id: 'getBusinesses',
    label: 'Business list',
    path: '/businesses',
    pages: ['/home'],
    handler: [
      { scenario: 'OK', handler: http.get('/businesses', () => HttpResponse.json([{ id: 1 }])) },
      { scenario: 'Empty', handler: http.get('/businesses', () => HttpResponse.json([])) },
    ],
  },
  {
    id: 'getUser',
    label: 'My profile',
    path: '/users/me',
    handler: http.get('/users/me', () => HttpResponse.json({ id: 7 })),
  },
]

let cuesheet: Cuesheet | undefined

function setup(defaultEnabled = true): Cuesheet {
  cuesheet = createCuesheet({ handlers, baseUrl: BASE_URL, defaultEnabled, log: false })
  return cuesheet
}

afterEach(() => {
  cuesheet?.stop()
  cuesheet = undefined
})

describe('createCuesheet', () => {
  it('relative handlers catch requests sent to the base URL', async () => {
    setup().start()
    const response = await fetch(`${BASE_URL}/users/me`)
    await expect(response.json()).resolves.toEqual({ id: 7 })
  })

  it('returns the response of the selected scenario', async () => {
    const cue = setup()
    cue.start()
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([{ id: 1 }])

    cue.select('getBusinesses', 'Empty')
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([])
  })

  it('the first scenario is the default when none is selected', async () => {
    const cue = setup()
    cue.start()
    expect(cue.getState().api.getBusinesses?.scenario).toBeUndefined()
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([{ id: 1 }])
  })

  it('disabling a handler stops intercepting only its requests', async () => {
    const cue = setup()
    cue.start()
    cue.patch({ api: { getUser: { enabled: false } } })
    // Without interception it goes to the real network and fails (the host doesn't exist)
    await expect(fetch(`${BASE_URL}/users/me`)).rejects.toThrow()
    // Other enabled handlers keep working
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([{ id: 1 }])
  })

  it('stop() releases interception', async () => {
    const cue = setup()
    cue.start()
    await expect((await fetch(`${BASE_URL}/users/me`)).json()).resolves.toEqual({ id: 7 })
    cue.stop()
    await expect(fetch(`${BASE_URL}/users/me`)).rejects.toThrow()
  })

  it('delay postpones the response accordingly', async () => {
    const cue = setup()
    cue.start()
    cue.patch({ delay: { min: 120, max: 120 } })
    const startedAt = Date.now()
    await fetch(`${BASE_URL}/users/me`)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(100)
  })

  it('start() applies the time condition and stop() restores it', () => {
    const cue = setup()
    cue.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    cue.start()
    expect(new Date().toISOString()).toBe('2026-01-31T09:00:00.000Z')
    cue.stop()
    expect(new Date().getFullYear()).toBeGreaterThan(2000)
  })

  it('turning cuesheet off restores the real clock, and turning it on applies the time again', () => {
    const cue = setup()
    cue.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    cue.start()
    cue.patch({ enabled: false })
    expect(new Date().toISOString()).not.toBe('2026-01-31T09:00:00.000Z')
    cue.patch({ enabled: true })
    expect(new Date().toISOString()).toBe('2026-01-31T09:00:00.000Z')
    cue.stop()
  })

  it('state changes reach subscribers', () => {
    const cue = setup()
    const seen: string[] = []
    const off = cue.subscribe((state) => seen.push(state.api.getBusinesses?.scenario ?? '-'))
    cue.select('getBusinesses', 'Empty')
    off()
    cue.select('getBusinesses', 'OK')
    expect(seen).toEqual(['Empty'])
  })

  it('the catalog is sorted by path and includes scenario options', () => {
    const catalog = setup().getCatalog()
    expect(Object.keys(catalog)).toEqual(['getBusinesses', 'getUser'])
    expect(catalog.getBusinesses?.scenarios).toEqual([
      { value: 'OK', label: 'OK' },
      { value: 'Empty', label: 'Empty' },
    ])
    expect(catalog.getUser?.scenarios).toBeUndefined()
  })

  it('throws at creation on duplicate ids', () => {
    expect(() =>
      createCuesheet({
        handlers: [...handlers, handlers[0] as CueHandler],
        defaultEnabled: true,
        log: false,
      }),
    ).toThrow(/more than once/)
  })

  it('intercepts nothing when defaultEnabled is false', async () => {
    setup(false).start()
    await expect(fetch(`${BASE_URL}/users/me`)).rejects.toThrow()
  })
})

describe('select typo protection', () => {
  it('throws on an unknown scenario, listing the available values', () => {
    const cue = setup()
    expect(() => cue.select('getBusinesses', 'Emtpy')).toThrow(/Available: OK, Empty/)
    // If it threw, the state must be unchanged
    expect(cue.getState().api.getBusinesses?.scenario).toBeUndefined()
  })

  it('throws on an unknown handler, listing the available ids', () => {
    const cue = setup()
    expect(() => cue.select('missingHandler', 'OK')).toThrow(/Available ids: getBusinesses, getUser/)
  })

  it('reports when the handler has no scenarios', () => {
    const cue = setup()
    expect(() => cue.select('getUser', 'anything')).toThrow(/has no scenarios/)
  })

  it('accepts valid values', () => {
    const cue = setup()
    expect(() => cue.select('getBusinesses', 'Empty')).not.toThrow()
    expect(cue.getState().api.getBusinesses?.scenario).toBe('Empty')
  })

  describe('replaceHandlers', () => {
    const replaced: CueHandler[] = [
      {
        id: 'getBusinesses',
        label: 'Business list',
        path: '/businesses',
        handler: [
          { scenario: 'OK', handler: http.get('/businesses', () => HttpResponse.json([{ id: 2 }])) },
          { scenario: 'Empty', handler: http.get('/businesses', () => HttpResponse.json(['empty'])) },
        ],
      },
      {
        id: 'getOrders',
        label: 'Order list',
        path: '/orders',
        handler: http.get('/orders', () => HttpResponse.json([])),
      },
    ]

    it('responds with the new handlers and keeps the selected scenario', async () => {
      const cue = setup()
      cue.start()
      cue.select('getBusinesses', 'Empty')

      cue.replaceHandlers(replaced)

      expect(cue.getState().api.getBusinesses?.scenario).toBe('Empty')
      await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual(['empty'])
    })

    it('updates the catalog and new handlers follow the defaults', async () => {
      const cue = setup()
      cue.start()
      cue.replaceHandlers(replaced)

      expect(Object.keys(cue.getCatalog())).toEqual(['getBusinesses', 'getOrders'])
      expect(cue.getState().api.getOrders).toEqual({ enabled: true })
      await expect((await fetch(`${BASE_URL}/orders`)).json()).resolves.toEqual([])
    })

    it('notifies subscribers', () => {
      const cue = setup()
      let calls = 0
      cue.subscribe(() => {
        calls += 1
      })
      cue.replaceHandlers(replaced)
      expect(calls).toBe(1)
    })

    it('deselects removed scenarios and drops state of removed handlers', () => {
      const cue = setup()
      cue.select('getBusinesses', 'Empty')

      cue.replaceHandlers([
        {
          id: 'getBusinesses',
          label: 'Business list',
          path: '/businesses',
          handler: [{ scenario: 'New OK', handler: http.get('/businesses', () => HttpResponse.json([])) }],
        },
      ])

      expect(cue.getState().api).toEqual({ getBusinesses: { enabled: true } })
      expect(cue.toShareParam()).toBe('on')
    })

    it('throws on invalid definitions and keeps the existing handlers', () => {
      const cue = setup()
      expect(() => cue.replaceHandlers([replaced[1] as CueHandler, replaced[1] as CueHandler])).toThrow(
        'more than once',
      )
      expect(Object.keys(cue.getCatalog())).toEqual(['getBusinesses', 'getUser'])
    })
  })

  it('drops stale handlers and scenarios left in storage when reading', () => {
    const storage = new Map<string, string>()
    storage.set(
      'cuesheet:state',
      JSON.stringify({
        enabled: true,
        api: { getBusinesses: { enabled: true, scenario: 'Removed scenario' }, gone: { enabled: true } },
        delay: { min: 0, max: 0 },
        time: null,
        network: { offline: false },
      }),
    )
    cuesheet = createCuesheet({
      handlers,
      defaultEnabled: true,
      log: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value)
        },
      },
    })
    expect(cuesheet.getState().api).toEqual({ getBusinesses: { enabled: true }, getUser: { enabled: true } })
  })

  it('the next handler can read the body even if a previous one read it and declined', async () => {
    cuesheet = createCuesheet({
      baseUrl: BASE_URL,
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'peek',
          label: 'peek',
          path: '/echo',
          handler: http.post('/echo', async ({ request }) => {
            await request.json()
            return undefined
          }),
        },
        {
          id: 'echo',
          label: 'echo',
          path: '/echo',
          handler: http.post('/echo', async ({ request }) => HttpResponse.json(await request.json())),
        },
      ],
    })
    cuesheet.start()
    const response = await fetch(`${BASE_URL}/echo`, { method: 'POST', body: JSON.stringify({ n: 1 }) })
    await expect(response.json()).resolves.toEqual({ n: 1 })
  })

  it('declaration order decides, even when a later handler matches the URL as it was sent', async () => {
    // With a base URL every request is tried in two forms: as sent, and with the base stripped. Trying the
    // sent form against all handlers first let a catch-all declared second answer ahead of the specific
    // handler declared first — msw's rule is the handler order, whichever form matched
    cuesheet = createCuesheet({
      baseUrl: BASE_URL,
      handlers: [
        {
          id: 'getUsers',
          label: 'Users',
          path: '/users',
          handler: http.get('/users', () => HttpResponse.json({ who: 'specific' })),
        },
        {
          id: 'catchAll',
          label: 'Everything else',
          path: '*',
          handler: http.all('*', () => HttpResponse.json({ who: 'fallback' })),
        },
      ],
      defaultEnabled: true,
      log: false,
      expose: false,
    })
    cuesheet.start()
    await expect((await fetch(`${BASE_URL}/users`)).json()).resolves.toEqual({ who: 'specific' })
  })

  it('the base URL must match up to a boundary — another domain with the same prefix is not taken offline', async () => {
    const cue = setup()
    cue.patch({ network: { offline: true } })
    cue.start()
    const recorded = cue.waitForRequest({ failed: true })
    await expect(fetch(`${BASE_URL}/users/me`)).rejects.toThrow()
    await recorded
    // It goes to the real network and ends in a DNS failure. It must not be cuesheet's offline error ('Failed to fetch')
    const error = await fetch('https://api.example.com.evil.test/x').catch((cause: Error) => cause)
    expect(cue.getRecords({ failed: true }).map((record) => record.url)).toEqual([`${BASE_URL}/users/me`])
    expect(error).toBeInstanceOf(Error)
  })
})

describe('patch', () => {
  it('turning a handler off and on keeps its selected scenario', () => {
    const cue = setup()
    cue.select('getBusinesses', 'Empty')
    cue.patch({ api: { getBusinesses: { enabled: false } } })
    expect(cue.getState().api.getBusinesses).toEqual({ enabled: false, scenario: 'Empty' })
    cue.patch({ api: { getBusinesses: { enabled: true } } })
    expect(cue.getState().api.getBusinesses).toEqual({ enabled: true, scenario: 'Empty' })
  })

  it('scenario: undefined goes back to the first scenario', () => {
    const cue = setup()
    cue.select('getBusinesses', 'Empty')
    cue.patch({ api: { getBusinesses: { scenario: undefined } } })
    expect(cue.getState().api.getBusinesses).toEqual({ enabled: true })
  })

  it('merges delay and network field by field', () => {
    const cue = setup()
    cue.patch({ delay: { min: 100, max: 900 } })
    cue.patch({ delay: { max: 500 } })
    expect(cue.getState().delay).toEqual({ min: 100, max: 500 })
    cue.patch({ network: {} })
    expect(cue.getState().network).toEqual({ offline: false })
  })

  it('a delay whose max is below its min is raised to the min', () => {
    const cue = setup()
    cue.patch({ delay: { min: 300, max: 100 } })
    expect(cue.getState().delay).toEqual({ min: 300, max: 300 })
  })
})

describe('the master switch', () => {
  it('select() while off warns instead of silently doing nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup(false)
    cue.select('getBusinesses', 'Empty')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cuesheet is off'))
    expect(cue.getState().api.getBusinesses?.scenario).toBe('Empty')
    warn.mockRestore()
  })

  it('handlers stay on by default, so turning cuesheet on mocks everything', () => {
    const cue = setup(false)
    expect(cue.getState().api.getUser?.enabled).toBe(true)
    cue.patch({ enabled: true })
    expect(cue.toShareParam()).toBe('on')
  })
})

describe('state storage', () => {
  function mapStorage(initial?: unknown) {
    const map = new Map<string, string>()
    if (initial !== undefined) {
      map.set('cuesheet:state', JSON.stringify(initial))
    }
    return {
      map,
      storage: {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => {
          map.set(key, value)
        },
      },
    }
  }

  it('keeps working in memory when saving fails — requests and the state agree', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    cuesheet = createCuesheet({
      handlers,
      baseUrl: BASE_URL,
      defaultEnabled: true,
      log: false,
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    })
    cuesheet.start()
    cuesheet.select('getBusinesses', 'Empty')
    expect(cuesheet.getState().api.getBusinesses?.scenario).toBe('Empty')
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([])
    error.mockRestore()
  })

  it('falls back field by field when the saved state is malformed', async () => {
    const { storage } = mapStorage({
      enabled: true,
      api: { getBusinesses: { enabled: true, scenario: 'Empty' }, getUser: 'yes' },
      delay: null,
      time: { now: 'not a date', mode: 'frozen' },
      network: null,
    })
    cuesheet = createCuesheet({ handlers, baseUrl: BASE_URL, defaultEnabled: true, log: false, storage })
    expect(cuesheet.getState()).toEqual({
      enabled: true,
      api: { getBusinesses: { enabled: true, scenario: 'Empty' }, getUser: { enabled: true } },
      delay: { min: 0, max: 0 },
      time: null,
      network: { offline: false },
    })
    expect(cuesheet.toShareParam()).toBe('on,getBusinesses:Empty')
    cuesheet.start()
    await expect((await fetch(`${BASE_URL}/businesses`)).json()).resolves.toEqual([])
  })

  it('subscribers get the same normalized object getState() returns', () => {
    const cue = setup()
    let seen: unknown
    cue.subscribe((state) => {
      seen = state
    })
    // A fractional delay is rounded, so what a link carries is what the state holds
    cue.patch({ delay: { min: 250.4, max: 300.6 } })
    expect(seen).toBe(cue.getState())
    expect(cue.getState().delay).toEqual({ min: 250, max: 301 })
  })

  it('getState() returns the same object until something changes', () => {
    const cue = setup()
    const first = cue.getState()
    expect(cue.getState()).toBe(first)
    cue.patch({ enabled: false })
    expect(cue.getState()).not.toBe(first)
  })

  it('exposes the store it uses, so the panel persists through the same one', () => {
    const { map, storage } = mapStorage()
    cuesheet = createCuesheet({ handlers, defaultEnabled: true, log: false, storage })
    expect(cuesheet.storage).toBe(storage)
    cuesheet.storage.setItem('cuesheet:panel-open', 'true')
    expect(map.get('cuesheet:panel-open')).toBe('true')
  })

  it('falls back to memory, which is still exposed, when no store is given', () => {
    const cue = setup()
    cue.storage.setItem('key', 'value')
    expect(cue.storage.getItem('key')).toBe('value')
    expect(cue.storage.getItem('missing')).toBeNull()
  })
})

/** IndexedDB, a database or an API can't answer before the app boots, so the read lands after the first render */
describe('a store that answers asynchronously', () => {
  function asyncStorage(initial?: unknown) {
    const map = new Map<string, string>()
    if (initial !== undefined) {
      map.set('cuesheet:state', JSON.stringify(initial))
    }
    return {
      map,
      storage: {
        getItem: (key: string) => Promise.resolve(map.get(key) ?? null),
        setItem: async (key: string, value: string) => {
          map.set(key, value)
        },
      },
    }
  }

  it('starts from the defaults and applies the stored state once it arrives, notifying subscribers', async () => {
    const { storage } = asyncStorage({
      enabled: true,
      api: { getBusinesses: { enabled: true, scenario: 'Empty' } },
    })
    cuesheet = createCuesheet({ handlers, defaultEnabled: false, log: false, storage })
    expect(cuesheet.getState().enabled).toBe(false)

    const seen: boolean[] = []
    cuesheet.subscribe((state) => seen.push(state.enabled))
    await vi.waitFor(() => expect(cuesheet?.getState().enabled).toBe(true))
    expect(cuesheet.getState().api.getBusinesses).toEqual({ enabled: true, scenario: 'Empty' })
    expect(seen).toEqual([true])
  })

  it('survives a handler replacement before the read landed — HMR is nobody choosing anything', async () => {
    const { storage } = asyncStorage({
      enabled: true,
      api: { getBusinesses: { enabled: true, scenario: 'Empty' } },
    })
    cuesheet = createCuesheet({ handlers, defaultEnabled: false, log: false, storage })
    // What the Vite plugin does when a mock file is edited. It used to count as a change by the app, so the
    // stored state arriving a tick later was thrown away and the page silently fell back to the defaults
    cuesheet.replaceHandlers(handlers)
    await vi.waitFor(() => expect(cuesheet?.getState().api.getBusinesses?.scenario).toBe('Empty'))
    expect(cuesheet.getState().enabled).toBe(true)
  })

  it('does not undo a state set before the read landed — a ?cue= link wins', async () => {
    const { storage } = asyncStorage({
      enabled: true,
      api: { getBusinesses: { enabled: true, scenario: 'Empty' } },
    })
    cuesheet = createCuesheet({ handlers, defaultEnabled: false, log: false, storage })
    cuesheet.select('getBusinesses', 'OK')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(cuesheet.getState().api.getBusinesses?.scenario).toBe('OK')
  })

  it('saves the last change last, even when the store finishes writes out of order', async () => {
    // A store whose writes settle in the order they are released, not the order they were made — an API
    // or a database under load. Two quick changes used to race, and the older one could land last, so the
    // next reload undid what the user did last
    const written: string[] = []
    const release: (() => void)[] = []
    const storage = {
      getItem: () => Promise.resolve(null),
      setItem: (_key: string, value: string) =>
        new Promise<void>((resolve) => {
          release.push(() => {
            written.push(value)
            resolve()
          })
        }),
    }
    cuesheet = createCuesheet({ handlers, defaultEnabled: false, log: false, storage })
    cuesheet.patch({ enabled: true })
    cuesheet.patch({ enabled: false })
    // Only the first write may be in flight; the second is queued behind it
    expect(release).toHaveLength(1)
    release[0]?.()
    await vi.waitFor(() => expect(release).toHaveLength(2))
    release[1]?.()
    await vi.waitFor(() => expect(written).toHaveLength(2))
    expect(cuesheet.getState().enabled).toBe(false)
    expect(JSON.parse(written[written.length - 1] ?? '{}').enabled).toBe(false)
  })

  it('writes through, and a rejected write leaves the state in memory', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { map, storage } = asyncStorage()
    cuesheet = createCuesheet({ handlers, defaultEnabled: true, log: false, storage })
    cuesheet.select('getBusinesses', 'Empty')
    await vi.waitFor(() => expect(map.get('cuesheet:state')).toContain('Empty'))

    cuesheet = createCuesheet({
      handlers,
      defaultEnabled: true,
      log: false,
      storage: { getItem: () => Promise.resolve(null), setItem: () => Promise.reject(new Error('offline')) },
    })
    cuesheet.select('getBusinesses', 'Empty')
    expect(cuesheet.getState().api.getBusinesses?.scenario).toBe('Empty')
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to save state'), expect.anything()),
    )
    error.mockRestore()
  })

  it('uses the defaults when the read rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    cuesheet = createCuesheet({
      handlers,
      defaultEnabled: true,
      log: false,
      storage: { getItem: () => Promise.reject(new Error('down')), setItem: () => Promise.resolve() },
    })
    expect(cuesheet.getState().enabled).toBe(true)
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to read state'), expect.anything()),
    )
    error.mockRestore()
  })
})

describe('start() outside the browser', () => {
  it('leaves fetch and Date alone', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    const { fetch: realFetch, Date: RealDate } = globalThis
    vi.stubGlobal('window', undefined)
    try {
      cue.start()
      expect(globalThis.fetch).toBe(realFetch)
      expect(globalThis.Date).toBe(RealDate)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('outside the browser'))
    } finally {
      vi.unstubAllGlobals()
      warn.mockRestore()
    }
  })
})

describe('streaming responses', () => {
  const encoder = new TextEncoder()
  /** A stream that sends one chunk and never ends */
  const endless = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: first\n\n'))
      },
    })

  for (const contentType of ['text/event-stream', 'application/x-ndjson']) {
    it(`a never-ending ${contentType} response reaches the app with records and logs on`, async () => {
      const log = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined)
      cuesheet = createCuesheet({
        baseUrl: BASE_URL,
        defaultEnabled: true,
        handlers: [
          {
            id: 'events',
            label: 'Events',
            path: '/events',
            handler: http.get(
              '/events',
              () => new HttpResponse(endless(), { headers: { 'content-type': contentType } }),
            ),
          },
        ],
      })
      cuesheet.start()
      const response = await fetch(`${BASE_URL}/events`)
      const reader = (response.body as ReadableStream<Uint8Array>).getReader()
      const { value } = await reader.read()
      expect(new TextDecoder().decode(value)).toBe('data: first\n\n')
      void reader.cancel()
      log.mockRestore()
    })
  }

  it('a never-ending stream of another type is still recorded, with what arrived so far', async () => {
    let cancelled = false
    cuesheet = createCuesheet({
      baseUrl: BASE_URL,
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'tokens',
          label: 'Tokens',
          path: '/tokens',
          handler: http.get(
            '/tokens',
            () =>
              new HttpResponse(
                new ReadableStream<Uint8Array>({
                  start(controller) {
                    controller.enqueue(encoder.encode('{"token":"a"}\n'))
                  },
                  cancel() {
                    cancelled = true
                  },
                }),
                { headers: { 'content-type': 'application/x-ndjson' } },
              ),
          ),
        },
      ],
    })
    cuesheet.start()
    const recorded = cuesheet.waitForRequest({ handlerId: 'tokens' }, { timeout: 3000 })
    const response = await fetch(`${BASE_URL}/tokens`)
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    await reader.read()
    void reader.cancel()
    const record = await recorded
    expect(record.responseBody).toBe('{"token":"a"}\n…')
    // Both copies are cancelled now, so the handler's stream hears about it
    await vi.waitFor(() => expect(cancelled).toBe(true))
  })

  it('an event stream is recorded without a body', async () => {
    cuesheet = createCuesheet({
      baseUrl: BASE_URL,
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'events',
          label: 'Events',
          path: '/events',
          handler: http.get(
            '/events',
            () => new HttpResponse(endless(), { headers: { 'content-type': 'text/event-stream' } }),
          ),
        },
      ],
    })
    cuesheet.start()
    const recorded = cuesheet.waitForRequest({ handlerId: 'events' })
    const response = await fetch(`${BASE_URL}/events`)
    const record = await recorded
    expect(record).toMatchObject({ handlerId: 'events', status: 200 })
    expect(record.responseBody).toBeUndefined()
    void response.body?.cancel()
  })
})

describe('aborting a delayed request', () => {
  /** Watches the 5 s delay timer: returns whether it was cleared before firing */
  function watchDelayTimer() {
    const ids = new Set<unknown>()
    const set = vi.spyOn(globalThis, 'setTimeout')
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    return {
      cleared: () => {
        for (const [index, call] of set.mock.calls.entries()) {
          if (call[1] === 5000) {
            ids.add(set.mock.results[index]?.value)
          }
        }
        return ids.size > 0 && clear.mock.calls.some(([id]) => ids.has(id))
      },
      restore: () => {
        set.mockRestore()
        clear.mockRestore()
      },
    }
  }

  it('fetch: stops the delay timer at once and records nothing', async () => {
    const cue = setup()
    cue.start()
    cue.patch({ delay: { min: 5000, max: 5000 } })
    const timer = watchDelayTimer()
    try {
      const controller = new AbortController()
      const pending = fetch(`${BASE_URL}/users/me`, { signal: controller.signal })
      await vi.waitFor(() =>
        expect(vi.mocked(setTimeout).mock.calls.some((call) => call[1] === 5000)).toBe(true),
      )
      controller.abort()
      await expect(pending).rejects.toThrow()
      await vi.waitFor(() => expect(timer.cleared()).toBe(true))
      expect(cue.getRecords()).toEqual([])
    } finally {
      timer.restore()
    }
  })

  it('XHR (axios): abort() stops the delay, no load fires and nothing goes to the network', async () => {
    const cue = setup()
    cue.start()
    cue.patch({ delay: { min: 5000, max: 5000 } })
    const timer = watchDelayTimer()
    try {
      const xhr = new XMLHttpRequest()
      const events: string[] = []
      for (const name of ['load', 'error', 'abort', 'loadend']) {
        xhr.addEventListener(name, () => events.push(name))
      }
      xhr.open('GET', `${BASE_URL}/users/me`)
      xhr.send()
      await vi.waitFor(() =>
        expect(vi.mocked(setTimeout).mock.calls.some((call) => call[1] === 5000)).toBe(true),
      )
      xhr.abort()
      await vi.waitFor(() => expect(timer.cleared()).toBe(true))
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(events).not.toContain('load')
      expect(cue.getRecords()).toEqual([])
    } finally {
      timer.restore()
    }
  })
})

describe('applyUrlParams', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('applies ?cue= and removes only it from the URL', () => {
    window.history.replaceState(null, '', '/page?tab=2&cue=getBusinesses:Empty,delay:300#top')
    const cue = setup()
    cue.applyUrlParams()
    expect(cue.getState().api.getBusinesses?.scenario).toBe('Empty')
    expect(cue.getState().delay).toEqual({ min: 300, max: 300 })
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/page?tab=2#top',
    )
  })

  it('an empty ?cue= changes nothing — it can not turn cuesheet on', () => {
    window.history.replaceState(null, '', '/?cue=&tab=2')
    const cue = setup(false)
    cue.applyUrlParams()
    expect(cue.getState().enabled).toBe(false)
    expect(window.location.search).toBe('?tab=2')
  })

  it('a value it cannot read leaves the state alone and writes nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    window.localStorage.removeItem('cuesheet:state')
    // Typed by hand, or pasted from somewhere else. 'OFF' is not a word of the grammar, and reading it as
    // "enter with the defaults" used to turn mocking on — and save that, so it stayed on after the reload
    window.history.replaceState(null, '', '/?cue=OFF')
    const cue = setup(false)
    cue.applyUrlParams()
    expect(cue.getState().enabled).toBe(false)
    expect(window.localStorage.getItem('cuesheet:state')).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could be read'))
    warn.mockRestore()
  })

  it('a share URL round-trips, including an ISO offset and spaces', () => {
    const scenarioHandlers: CueHandler[] = [
      {
        id: 'getBusinesses',
        label: 'Business list',
        path: '/businesses',
        handler: [
          { scenario: 'OK', handler: http.get('/businesses', () => HttpResponse.json([])) },
          { scenario: 'A+B and C', handler: http.get('/businesses', () => HttpResponse.json([])) },
        ],
      },
    ]
    const source = createCuesheet({
      handlers: scenarioHandlers,
      defaultEnabled: true,
      log: false,
      expose: false,
    })
    source.select('getBusinesses', 'A+B and C')
    source.patch({
      time: { now: '2026-01-31T09:00:00+09:00', mode: 'running' },
      delay: { min: 100, max: 200 },
    })
    const url = new URL(source.toShareUrl())
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)

    cuesheet = createCuesheet({
      handlers: scenarioHandlers,
      defaultEnabled: false,
      log: false,
      expose: false,
    })
    cuesheet.applyUrlParams()
    expect(cuesheet.getState()).toEqual(source.getState())
  })
})

describe('the catalog', () => {
  it('reports http.all() handlers as ALL', () => {
    cuesheet = createCuesheet({
      defaultEnabled: true,
      log: false,
      handlers: [
        { id: 'any', label: 'Any', path: '/any', handler: http.all('/any', () => HttpResponse.json({})) },
      ],
    })
    expect(cuesheet.getCatalog().any?.method).toBe('ALL')
  })
})

describe('waitForRequest cutoff', () => {
  it('a request sent before waiting began does not count, even if its record lands later', async () => {
    cuesheet = createCuesheet({
      baseUrl: BASE_URL,
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'slow',
          label: 'Slow body',
          path: '/slow',
          // The body never ends, so the record lands only after the read gives up
          handler: http.get('/slow', () => new HttpResponse(new ReadableStream({ start() {} }))),
        },
      ],
    })
    cuesheet.start()
    const response = await fetch(`${BASE_URL}/slow`)
    const waiting = cuesheet.waitForRequest({ handlerId: 'slow' }, { timeout: 1500 })
    await expect(waiting).rejects.toThrow(/arrived within/)
    expect(cuesheet.getRecords({ handlerId: 'slow' })).toHaveLength(1)
    void response.body?.cancel()
  })
})

describe('saved state, field by field', () => {
  it('keeps a valid scenario and delay bound next to a malformed sibling', () => {
    const map = new Map([
      [
        'cuesheet:state',
        JSON.stringify({
          enabled: true,
          api: { getBusinesses: { enabled: 'yes', scenario: 'Empty' } },
          delay: { min: 300, max: 'slow' },
        }),
      ],
    ])
    cuesheet = createCuesheet({
      handlers,
      defaultEnabled: true,
      log: false,
      storage: {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => {
          map.set(key, value)
        },
      },
    })
    expect(cuesheet.getState().api.getBusinesses).toEqual({ enabled: true, scenario: 'Empty' })
    expect(cuesheet.getState().delay).toEqual({ min: 300, max: 300 })
  })
})

describe('options under exactOptionalPropertyTypes', () => {
  it('accept undefined for every optional option, as a conditional value produces', () => {
    const maybe = <T>(value: T): T | undefined => (Math.random() > 2 ? value : undefined)
    cuesheet = createCuesheet({
      handlers,
      defaultEnabled: true,
      baseUrl: maybe(BASE_URL),
      storage: maybe(window.localStorage),
      log: maybe(false),
      plugins: maybe([]),
      expose: maybe(false),
      record: { limit: maybe(10), bodies: maybe(true) },
    })
    expect(cuesheet.getRecords({ handlerId: maybe('getUser'), path: maybe('/users') })).toEqual([])
  })
})

describe('share links reopen what they carry', () => {
  it('a time given in a non-ISO form is stored as ISO, so its link reopens', () => {
    const source = setup()
    source.patch({ time: { now: '2026-01-31 09:00', mode: 'frozen' } })
    expect(source.getState().time?.now).toBe(new Date('2026-01-31 09:00').toISOString())
    const param = source.toShareParam()
    expect(param).not.toContain(' ')

    window.history.replaceState(null, '', `/?cue=${encodeURIComponent(param)}`)
    const target = createCuesheet({ handlers, defaultEnabled: false, log: false, expose: false })
    target.applyUrlParams()
    expect(target.getState().time).toEqual(source.getState().time)
    window.history.replaceState(null, '', '/')
  })

  it('toShareUrl() leaves the other query parameters byte for byte too', () => {
    window.history.replaceState(null, '', '/p?redirect=/orders/1%20a&debug&x=a+b#h')
    const cue = setup()
    cue.patch({ network: { offline: true } })
    // Going through URLSearchParams would hand back '?redirect=%2Forders%2F1+a&debug=&x=a+b', a URL the app
    // itself never wrote — and one that no longer says what it said
    expect(cue.toShareUrl()).toBe(
      'http://localhost:3000/p?redirect=/orders/1%20a&debug&x=a+b&cue=on,offline#h',
    )
    window.history.replaceState(null, '', '/')
  })

  it('applyUrlParams() leaves the other query parameters byte for byte', () => {
    window.history.replaceState(null, '', '/p?redirect=/orders/1%20a&debug&cue=on&x=a+b#h')
    setup().applyUrlParams()
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/p?redirect=/orders/1%20a&debug&x=a+b#h',
    )
    window.history.replaceState(null, '', '/')
  })
})

describe('stop() then start() again', () => {
  it('intercepts and applies the clock again', async () => {
    const cue = setup()
    cue.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    cue.start()
    cue.stop()
    cue.start()
    expect(new Date().toISOString()).toBe('2026-01-31T09:00:00.000Z')
    await expect((await fetch(`${BASE_URL}/users/me`)).json()).resolves.toEqual({ id: 7 })
  })
})

describe('a second instance starting', () => {
  function instance(user: number): Cuesheet {
    return createCuesheet({
      baseUrl: BASE_URL,
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'getUser',
          label: 'My profile',
          path: '/users/me',
          handler: http.get('/users/me', () => HttpResponse.json({ id: user })),
        },
      ],
    })
  }
  const user = async () => (await fetch(`${BASE_URL}/users/me`)).json()

  // What the Vite plugin does when its module re-runs: a new instance starts while the old one is still running.
  // Both used to share one interceptor, and the new one's listener never got attached
  it('takes over interception and stops the one before it', async () => {
    const first = instance(1)
    first.start()
    const second = instance(2)
    cuesheet = second
    second.start()
    await expect(user()).resolves.toEqual({ id: 2 })
    // Stopping the old one again must not take interception away from the new one
    first.stop()
    await expect(user()).resolves.toEqual({ id: 2 })
  })

  it('hands interception back when the earlier one starts again', async () => {
    const first = instance(1)
    first.start()
    const second = instance(2)
    second.start()
    cuesheet = first
    first.start()
    await expect(user()).resolves.toEqual({ id: 1 })
    second.stop()
    await expect(user()).resolves.toEqual({ id: 1 })
  })

  it('moves window.__cuesheet__ to whichever instance is running', () => {
    const first = instance(1)
    const second = instance(2)
    first.start()
    second.start()
    cuesheet = first
    first.start()
    expect(window.__cuesheet__).toBe(first)
    second.stop()
  })

  it('ignores changes made through an instance another one took over, so they are not saved either', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const first = instance(1)
    first.start()
    const second = instance(2)
    cuesheet = second
    second.start()
    first.patch({ enabled: false })
    expect(first.getState().enabled).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('another cuesheet instance took over'))
    // Starting it again makes it the one that answers, and its changes count again
    cuesheet = first
    first.start()
    first.patch({ enabled: false })
    expect(first.getState().enabled).toBe(false)
    second.stop()
    warn.mockRestore()
  })

  it('takes the clock over too', () => {
    const first = instance(1)
    first.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    first.start()
    const second = instance(2)
    cuesheet = second
    second.start()
    expect(new Date().toISOString()).not.toBe('2026-01-31T09:00:00.000Z')
  })
})

describe('patch() with names cuesheet does not know', () => {
  it('ignores an unknown handler id and warns, applying the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ api: { nope: { enabled: false }, getUser: { enabled: false } } })
    expect(cue.getState().api).toEqual({ getBusinesses: { enabled: true }, getUser: { enabled: false } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no handler named 'nope'; ignored"))
    warn.mockRestore()
  })

  it('ignores an unknown scenario and warns, keeping the selected one and the other fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.select('getBusinesses', 'Empty')
    cue.patch({ api: { getBusinesses: { enabled: false, scenario: 'Missing' } } })
    expect(cue.getState().api.getBusinesses).toEqual({ enabled: false, scenario: 'Empty' })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("has no scenario 'Missing'; ignored. Available: OK, Empty"),
    )
    warn.mockRestore()
  })

  it('ignores an enabled value that is not a boolean and warns, keeping the switch as it was', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // defaultEnabled false, then turned on by hand — what a panel or a link does
    const cue = setup(false)
    cue.patch({ enabled: true })
    // Without validation this falls through to normalizeState, whose only fallback is defaultEnabled — so
    // cuesheet would quietly switch itself off for a caller who asked for neither
    cue.patch({ enabled: 'yes' as unknown as boolean })
    expect(cue.getState().enabled).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('enabled takes true or false'))
    warn.mockRestore()
  })

  it("ignores a handler's enabled that is not a boolean and warns, keeping it as it was", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ api: { getBusinesses: { enabled: false } } })
    // `normalizeState` can only read a non-boolean as `true`, so this used to turn the handler back **on**
    // without a word — the opposite of what the caller wrote
    cue.patch({ api: { getBusinesses: { enabled: 'false' } } as unknown as ApiPatch })
    expect(cue.getState().api.getBusinesses?.enabled).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'getBusinesses'.enabled takes true or false"))
    warn.mockRestore()
  })

  it('warns instead of throwing when patch() is called with nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    // What an agent or a console user does. It used to be a TypeError from inside the library
    expect(() => (cue.patch as () => void)()).not.toThrow()
    expect(cue.getState().enabled).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('patch() takes an object'))
    warn.mockRestore()
  })

  it('ignores a network value that is not a boolean and warns, keeping offline as it was', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ network: { offline: true } })
    // Without validation this would silently fall back to offline: false while the caller thinks it stayed on
    cue.patch({ network: { offline: 'yes' } as unknown as { offline: boolean } })
    expect(cue.getState().network).toEqual({ offline: true })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('network.offline takes true or false'))
    warn.mockRestore()
  })
})

describe('smaller edges', () => {
  it('a body-less POST reaches the handler without a body', async () => {
    let body: unknown = 'unset'
    cuesheet = createCuesheet({
      baseUrl: `${BASE_URL}/v1`,
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'logout',
          label: 'Log out',
          path: '/logout',
          handler: http.post('/logout', ({ request }) => {
            body = request.body
            return HttpResponse.json({})
          }),
        },
      ],
    })
    cuesheet.start()
    await fetch(`${BASE_URL}/v1/logout`, { method: 'POST' })
    expect(body).toBeNull()
  })

  it('help() says requests go to the real server while cuesheet is off', () => {
    const cue = setup(false)
    expect(cue.help()).toContain("now: real server — cuesheet is off (OK (default) once it's on)")
  })

  it('a matcher key cuesheet does not know throws instead of matching everything', () => {
    const cue = setup()
    expect(() => cue.getRecords({ id: 'getUser' } as never)).toThrow(/Use 'handlerId' for the handler id/)
    // Thrown where it was written, not handed back as a rejection nobody may await
    expect(() => cue.waitForRequest({ id: 'getUser' } as never)).toThrow(/Unknown record matcher key/)
  })

  it('a scenario label is shown in the catalog; the name stays the value', () => {
    cuesheet = createCuesheet({
      defaultEnabled: true,
      log: false,
      handlers: [
        {
          id: 'getCoupons',
          label: 'Coupons',
          path: '/coupons',
          handler: [
            { scenario: 'OK', handler: http.get('/coupons', () => HttpResponse.json([])) },
            {
              scenario: 'Empty',
              label: 'No coupons',
              handler: http.get('/coupons', () => HttpResponse.json([])),
            },
          ],
        },
      ],
    })
    expect(cuesheet.getCatalog().getCoupons?.scenarios).toEqual([
      { value: 'OK', label: 'OK' },
      { value: 'Empty', label: 'No coupons' },
    ])
  })
})

describe('baseUrl forms', () => {
  const me: CueHandler[] = [
    { id: 'me', label: 'Me', path: '/me', handler: http.get('/me', () => HttpResponse.json({ ok: 1 })) },
  ]

  it.each([
    ['a relative path, as behind a dev proxy', '/api', `${window.location.origin}/api/me`],
    ['an upper-case host', 'https://API.example.com', 'https://api.example.com/me'],
    ['a default port', 'https://api.example.com:443/v1/', 'https://api.example.com/v1/me'],
  ])('matches %s', async (_, baseUrl, url) => {
    cuesheet = createCuesheet({ baseUrl, defaultEnabled: true, log: false, expose: false, handlers: me })
    cuesheet.start()
    await expect((await fetch(url)).json()).resolves.toEqual({ ok: 1 })
  })

  it('throws at creation on something that is not a URL', () => {
    expect(() =>
      createCuesheet({ baseUrl: 'http://', defaultEnabled: true, log: false, handlers: me }),
    ).toThrow(/baseUrl/)
  })
})

describe('patch() values it cannot use', () => {
  it('keeps the clock and warns on an invalid time', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'running' } })
    cue.patch({ time: { now: 'garbage', mode: 'frozen' }, network: { offline: true } })
    expect(cue.getState().time).toEqual({ now: '2026-01-31T09:00:00.000Z', mode: 'running' })
    expect(cue.getState().network.offline).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('patch(): time takes'))
    warn.mockRestore()
  })

  it('keeps the delay and warns on a negative or non-number delay', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ delay: { min: 100, max: 200 } })
    cue.patch({ delay: { min: -1 } })
    cue.patch({ delay: { max: '500' as never } })
    expect(cue.getState().delay).toEqual({ min: 100, max: 200 })
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('skips a handler entry that is not an object, and applies the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cue = setup()
    cue.patch({ api: { getBusinesses: undefined, getUser: { enabled: false } } as never })
    expect(cue.getState().api.getUser?.enabled).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'getBusinesses' must be an object"))
    warn.mockRestore()
  })
})

describe('help() names the handle it is exposed under', () => {
  it('uses a custom expose key, and the instance itself when not exposed', () => {
    const custom = createCuesheet({ handlers, defaultEnabled: true, log: false, expose: '__qa__' })
    expect(custom.help()).toContain("window.__qa__.select('<handlerId>'")
    const hidden = createCuesheet({ handlers, defaultEnabled: true, log: false, expose: false })
    expect(hidden.help()).toContain("  cuesheet.select('<handlerId>'")
  })
})

describe('every state the API can reach survives a share link', () => {
  it.each<[string, (cue: Cuesheet) => void]>([
    ['defaults', () => undefined],
    ['a scenario', (cue) => cue.select('getBusinesses', 'Empty')],
    [
      'a turned-off handler with a scenario',
      (cue) => {
        cue.select('getBusinesses', 'Empty')
        cue.patch({ api: { getBusinesses: { enabled: false } } })
      },
    ],
    ['a fractional delay range', (cue) => cue.patch({ delay: { min: 120.7, max: 999.2 } })],
    ['a loose time, running', (cue) => cue.patch({ time: { now: '2026-01-31 09:00', mode: 'running' } })],
    ['an offset time', (cue) => cue.patch({ time: { now: '2026-01-31T09:00:00+09:00', mode: 'frozen' } })],
    ['offline', (cue) => cue.patch({ network: { offline: true } })],
    ['off', (cue) => cue.patch({ enabled: false })],
  ])('%s', (_, arrange) => {
    const source = setup()
    arrange(source)
    window.history.replaceState(null, '', new URL(source.toShareUrl()).search)
    const target = createCuesheet({
      handlers,
      baseUrl: BASE_URL,
      defaultEnabled: false,
      log: false,
      expose: false,
    })
    target.applyUrlParams()
    window.history.replaceState(null, '', '/')
    expect(target.getState()).toEqual(source.getState())
  })
})
