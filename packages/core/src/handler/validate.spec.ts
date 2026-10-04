import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import type { CueHandler } from './index'
import { assertValidHandlers } from './validate'

const ok = http.get('/ok', () => HttpResponse.json({}))

describe('assertValidHandlers', () => {
  it('accepts valid definitions', () => {
    expect(() => assertValidHandlers([{ id: 'a', label: 'A', path: '/a', handler: ok }])).not.toThrow()
  })

  it('throws on duplicate ids', () => {
    const handlers: CueHandler[] = [
      { id: 'dup', label: 'A', path: '/a', handler: ok },
      { id: 'dup', label: 'B', path: '/b', handler: ok },
    ]
    expect(() => assertValidHandlers(handlers)).toThrow(/dup.*more than once/s)
  })

  it("throws on the id '__proto__', which no state object can hold", () => {
    // `state.api[id] = ...` would set the prototype instead of adding an entry, so the handler would be
    // listed in the catalog and then never match anything
    expect(() => assertValidHandlers([{ id: '__proto__', label: 'P', path: '/p', handler: ok }])).toThrow(
      /__proto__/,
    )
  })

  it('throws on an empty scenario array', () => {
    expect(() => assertValidHandlers([{ id: 'empty', label: 'E', path: '/e', handler: [] }])).toThrow(
      /empty scenario array/,
    )
  })

  it('throws on duplicate scenario cases', () => {
    const handlers: CueHandler[] = [
      {
        id: 'x',
        label: 'X',
        path: '/x',
        handler: [
          { scenario: 'OK', handler: ok },
          { scenario: 'OK', handler: ok },
        ],
      },
    ]
    expect(() => assertValidHandlers(handlers)).toThrow(/defines scenario 'OK' more than once/)
  })

  it('reports all problems at once', () => {
    const handlers: CueHandler[] = [
      { id: 'dup', label: 'A', path: '/a', handler: ok },
      { id: 'dup', label: 'B', path: '/b', handler: ok },
      { id: 'empty', label: 'E', path: '/e', handler: [] },
    ]
    expect(() => assertValidHandlers(handlers)).toThrow(/dup[\s\S]*empty/)
  })
})

describe('names a ?cue= link must be able to carry', () => {
  it.each(['on', 'off', 'offline', 'delay', 'time', '-probe', 'a,b', 'a:b', ' padded'])(
    'rejects the handler id %j',
    (id) => {
      expect(() => assertValidHandlers([{ id, label: 'X', path: '/x', handler: ok }])).toThrow(
        /Invalid handler definitions/,
      )
    },
  )

  it.each(['A,B', ' OK', 'OK ', ''])('rejects the scenario name %j', (name) => {
    expect(() =>
      assertValidHandlers([{ id: 'x', label: 'X', path: '/x', handler: [{ scenario: name, handler: ok }] }]),
    ).toThrow(/Invalid handler definitions/)
  })

  it('accepts names with spaces, colons and plus signs inside', () => {
    expect(() =>
      assertValidHandlers([
        {
          id: 'getCoupons',
          label: 'X',
          path: '/x',
          handler: [
            { scenario: 'Server error', handler: ok },
            { scenario: 'A+B: C', handler: ok },
          ],
        },
      ]),
    ).not.toThrow()
  })
})
