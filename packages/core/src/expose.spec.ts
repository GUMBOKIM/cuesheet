import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type Cuesheet, createCuesheet } from './createCuesheet'
import type { CueHandler } from './handler'

const handlers: CueHandler[] = [
  {
    id: 'getUser',
    label: 'My profile',
    path: '/users/me',
    handler: http.get('/users/me', () => HttpResponse.json({ id: 1 })),
  },
]

function make(expose?: boolean | string): Cuesheet {
  return createCuesheet({
    handlers,
    defaultEnabled: true,
    log: false,
    ...(expose === undefined ? {} : { expose }),
  })
}

afterEach(() => {
  delete window.__cuesheet__
  delete (window as unknown as Record<string, unknown>).myCue
})

describe('global exposure', () => {
  it('installs on window.__cuesheet__ by default', () => {
    const cuesheet = make()
    expect(window.__cuesheet__).toBe(cuesheet)
  })

  it('does not install with expose: false', () => {
    make(false)
    expect(window.__cuesheet__).toBeUndefined()
  })

  it('installs under the given name when passed a string', () => {
    const cuesheet = make('myCue')
    expect((window as unknown as Record<string, unknown>).myCue).toBe(cuesheet)
    expect(window.__cuesheet__).toBeUndefined()
  })

  it('an instance that is only created does not take the handle from the running one', () => {
    const running = make()
    running.start()
    const idle = make()
    try {
      expect(window.__cuesheet__).toBe(running)
      // Starting it is what hands the handle over
      idle.start()
      expect(window.__cuesheet__).toBe(idle)
    } finally {
      idle.stop()
      running.stop()
    }
  })

  it('the global handle can control the state', () => {
    make()
    window.__cuesheet__?.patch({ delay: { min: 50, max: 50 } })
    expect(window.__cuesheet__?.getState().delay).toEqual({ min: 50, max: 50 })
  })
})

describe('help()', () => {
  it('lists handlers with their current setting and points to the guide', () => {
    const cuesheet = createCuesheet({
      handlers: [
        ...handlers,
        {
          id: 'getOrders',
          label: 'Order list',
          path: '/orders',
          handler: [
            { scenario: 'OK', handler: http.get('/orders', () => HttpResponse.json([])) },
            { scenario: 'Empty', handler: http.get('/orders', () => HttpResponse.json([])) },
          ],
        },
      ],
      defaultEnabled: true,
      log: false,
    })
    cuesheet.select('getOrders', 'Empty')

    const text = cuesheet.help()
    expect(text).toContain('getOrders  GET /orders\n    scenarios: OK | Empty\n    now: Empty')
    expect(text).toContain('getUser  GET /users/me\n    scenarios: (single response)\n    now: on')
    cuesheet.reset()
    expect(cuesheet.help()).toContain('scenarios: OK | Empty\n    now: OK (default)')
    expect(text).toContain('State now: ?cue=on,getOrders:Empty')
    expect(text).toContain('node_modules/cuesheet/AGENTS.md')
  })
})

describe('start log', () => {
  it('points to help() once started', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const cuesheet = createCuesheet({ handlers, defaultEnabled: true })
    cuesheet.start()
    cuesheet.stop()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toContain('on with 1 handler. Run window.__cuesheet__.help()')
    info.mockRestore()
  })

  it('stays quiet with log: false', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const cuesheet = make()
    cuesheet.start()
    cuesheet.stop()
    expect(info).not.toHaveBeenCalled()
    info.mockRestore()
  })
})
