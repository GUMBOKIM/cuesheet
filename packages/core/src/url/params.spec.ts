import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import type { CueHandler } from '../handler'
import type { CueState } from '../state'
import { applyCueParam, toCueParam, withCueParam } from './params'

const json = (body: object) => http.get('/businesses', () => HttpResponse.json(body))

const handlers: CueHandler[] = [
  {
    id: 'getBusinesses',
    label: 'Business list',
    path: '/businesses',
    handler: [
      { scenario: 'Individual', handler: json([{ type: 'individual' }]) },
      { scenario: 'Corporate', handler: json([{ type: 'corporate' }]) },
    ],
  },
  { id: 'getUser', label: 'My profile', path: '/users/me', handler: json({ id: 1 }) },
]

/** Every value read here is one cuesheet understands, so it always gives a state back */
function apply(raw: string): CueState {
  const state = applyCueParam(raw, handlers)
  if (state === undefined) {
    throw new Error(`'${raw}' was not understood`)
  }
  return state
}

describe('applyCueParam', () => {
  it('off turns everything off', () => {
    const state = apply('off')
    expect(state.enabled).toBe(false)
    // Only the master switch is off; handlers keep their default, so turning it back on means "all defaults"
    expect(state.api.getBusinesses?.enabled).toBe(true)
  })

  it('on enables every handler', () => {
    const state = apply('on')
    expect(state.enabled).toBe(true)
    expect(state.api.getBusinesses?.enabled).toBe(true)
    expect(state.api.getUser?.enabled).toBe(true)
  })

  it('selects a scenario', () => {
    const state = apply('getBusinesses:Corporate')
    expect(state.api.getBusinesses).toEqual({ enabled: true, scenario: 'Corporate' })
  })

  it('ignores unknown handlers and scenarios and applies the rest', () => {
    const state = apply('nope:x,getBusinesses:missingCase,delay:100')
    expect(state.api.getBusinesses?.scenario).toBeUndefined()
    expect(state.delay).toEqual({ min: 100, max: 100 })
  })

  it('delay accepts both a fixed value and a range', () => {
    expect(apply('delay:800-2000').delay).toEqual({ min: 800, max: 2000 })
    expect(apply('delay:500').delay).toEqual({ min: 500, max: 500 })
    expect(apply('on,delay:2000-800').delay).toEqual({ min: 0, max: 0 })
  })

  it('time is frozen by default and advances with /running', () => {
    expect(apply('time:2026-01-31T09:00:00Z').time).toEqual({
      now: '2026-01-31T09:00:00Z',
      mode: 'frozen',
    })
    expect(apply('time:2026-01-31T09:00:00Z/running').time).toEqual({
      now: '2026-01-31T09:00:00Z',
      mode: 'running',
    })
  })

  it('restores an ISO offset turned into a space by query decoding', () => {
    // URLSearchParams decodes '+09:00' as ' 09:00'
    expect(apply('time:2026-01-31T09:00:00 09:00').time?.now).toBe('2026-01-31T09:00:00+09:00')
  })

  it('starts over from the defaults instead of inheriting the existing state', () => {
    const first = apply('getBusinesses:Corporate,delay:900')
    const second = apply('on')
    expect(first.api.getBusinesses?.scenario).toBe('Corporate')
    expect(second.api.getBusinesses?.scenario).toBeUndefined()
    expect(second.delay).toEqual({ min: 0, max: 0 })
  })
})

describe('toCueParam', () => {
  it('off when disabled', () => {
    expect(toCueParam(apply('off'), handlers)).toBe('off')
  })

  it('omits the default scenario', () => {
    const state = apply('getBusinesses:Individual')
    expect(toCueParam(state, handlers)).toBe('on')
  })

  it('round-trips to the same state', () => {
    const raw = 'on,getBusinesses:Corporate,delay:800-2000,time:2026-01-31T09:00:00Z'
    const state = apply(raw)
    expect(toCueParam(state, handlers)).toBe(raw)
    expect(apply(toCueParam(state, handlers))).toEqual(state)
  })
})

describe('turning a handler off', () => {
  it('-id turns that handler off and leaves the others on', () => {
    const state = apply('-getUser')
    expect(state.enabled).toBe(true)
    expect(state.api.getUser).toEqual({ enabled: false })
    expect(state.api.getBusinesses?.enabled).toBe(true)
  })

  it('ignores an unknown id', () => {
    const state = apply('-nope,delay:100')
    expect(state.api.getUser?.enabled).toBe(true)
    expect(state.delay).toEqual({ min: 100, max: 100 })
  })

  it('serializes a turned-off handler and round-trips', () => {
    const state = apply('on,getBusinesses:Corporate')
    state.api.getUser = { enabled: false }
    expect(toCueParam(state, handlers)).toBe('on,getBusinesses:Corporate,-getUser')
    expect(apply(toCueParam(state, handlers))).toEqual(state)
  })
})

describe('network', () => {
  it('the offline token turns offline on', () => {
    expect(apply('on,offline').network.offline).toBe(true)
    expect(apply('on').network.offline).toBe(false)
  })

  it('serialization includes offline', () => {
    const state = apply('on,offline')
    expect(toCueParam(state, handlers)).toBe('on,offline')
    expect(apply(toCueParam(state, handlers))).toEqual(state)
  })
})

describe('delay parsing', () => {
  it('rejects empty or extra pieces instead of reading them as 0', () => {
    expect(apply('on,delay:-500').delay).toEqual({ min: 0, max: 0 })
    expect(apply('on,delay:500-').delay).toEqual({ min: 0, max: 0 })
    expect(apply('on,delay:1-2-3').delay).toEqual({ min: 0, max: 0 })
    expect(apply('on,delay:1.5').delay).toEqual({ min: 0, max: 0 })
  })
})

describe('a turned-off handler keeps its scenario in a link', () => {
  it('round-trips both the off switch and the scenario, in either order', () => {
    const state = apply('on')
    state.api.getBusinesses = { enabled: false, scenario: 'Corporate' }
    const raw = toCueParam(state, handlers)
    expect(raw).toBe('on,-getBusinesses,getBusinesses:Corporate')
    expect(apply(raw)).toEqual(state)
    expect(apply('getBusinesses:Corporate,-getBusinesses').api.getBusinesses).toEqual({
      enabled: false,
      scenario: 'Corporate',
    })
  })
})

describe('time offsets in a typed link', () => {
  it('restores +HH:MM and +HHMM after a T time, and leaves a space-separated local time alone', () => {
    expect(apply('time:2026-01-31T09:00:00 0900').time?.now).toBe('2026-01-31T09:00:00+0900')
    expect(apply('time:2026-01-31T09:00 09:00').time?.now).toBe('2026-01-31T09:00+09:00')
    expect(apply('time:2026-01-31 09:00').time?.now).toBe('2026-01-31 09:00')
  })
})

describe('a value cuesheet cannot read', () => {
  it('leaves the state alone rather than turning mocking on', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // The one people actually type. 'off' is a word of the grammar, 'OFF' is not, and reading it as "enter
    // with the defaults" would turn mocking on for someone who wrote a link meaning the opposite
    expect(applyCueParam('OFF', handlers)).toBeUndefined()
    expect(applyCueParam('typo', handlers)).toBeUndefined()
    expect(applyCueParam('nope:x', handlers)).toBeUndefined()
    expect(applyCueParam('-nope', handlers)).toBeUndefined()
    expect(applyCueParam('delay:soon', handlers)).toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('still applies a value where one item was understood', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(apply('typo,on').enabled).toBe(true)
    expect(apply('nope:x,delay:100').delay).toEqual({ min: 100, max: 100 })
    warn.mockRestore()
  })
})

describe('withCueParam', () => {
  it('keeps the other parameters exactly as they were written', () => {
    // URLSearchParams would rewrite these to '?q=a+b&debug=&cue=on'
    expect(withCueParam('http://app.test/page?q=a%20b&debug', 'on')).toBe(
      'http://app.test/page?q=a%20b&debug&cue=on',
    )
    expect(withCueParam('http://app.test/', 'on')).toBe('http://app.test/?cue=on')
  })

  it('replaces a cue parameter already on the URL', () => {
    expect(withCueParam('http://app.test/?cue=off&q=1', 'on,offline')).toBe(
      'http://app.test/?q=1&cue=on,offline',
    )
  })

  it('leaves the grammar readable and escapes only what a query string would eat', () => {
    expect(
      withCueParam('http://app.test/', 'on,getBusinesses:Corporate,time:2026-01-31T09:00:00Z/running'),
    ).toBe('http://app.test/?cue=on,getBusinesses:Corporate,time:2026-01-31T09:00:00Z/running')
    // A scenario name with these in it would otherwise end the parameter, start the fragment, or come back
    // as a space — and the link would silently select something else, or nothing
    expect(withCueParam('http://app.test/', 'on,getBusinesses:A&B #1+2 50%')).toBe(
      'http://app.test/?cue=on,getBusinesses:A%26B%20%231%2B2%2050%25',
    )
  })

  it('round-trips names that are not ASCII, with spaces and brackets in them', () => {
    // The shape real handler sets turn out to have: the scenario names are sentences in the team's own
    // language, with spaces, brackets and arrows. They go through as percent-encoded UTF-8
    const named: CueHandler[] = [
      {
        id: 'authLogout',
        label: '로그아웃',
        path: '/auth/logout',
        handler: [
          { scenario: '정상', handler: json([]) },
          { scenario: '홈택스 미연결(→간편인증)', handler: json([]) },
        ],
      },
    ]
    const url = new URL(withCueParam('http://app.test/', 'on,authLogout:홈택스 미연결(→간편인증)'))
    expect(url.searchParams.get('cue')).toBe('on,authLogout:홈택스 미연결(→간편인증)')
    expect(applyCueParam(url.searchParams.get('cue') ?? '', named)?.api.authLogout?.scenario).toBe(
      '홈택스 미연결(→간편인증)',
    )
  })

  it('round-trips a scenario name a query string would otherwise mangle', () => {
    const named: CueHandler[] = [
      {
        id: 'getBusinesses',
        label: 'Business list',
        path: '/businesses',
        handler: [
          { scenario: 'Individual', handler: json([]) },
          { scenario: 'A&B #1+2 50%', handler: json([]) },
        ],
      },
    ]
    const url = new URL(withCueParam('http://app.test/', 'on,getBusinesses:A&B #1+2 50%'))
    const raw = url.searchParams.get('cue') ?? ''
    expect(applyCueParam(raw, named)?.api.getBusinesses?.scenario).toBe('A&B #1+2 50%')
  })
})
