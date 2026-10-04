import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectHandlers } from './collect'
import type { CueHandler } from './index'

const make = (id: string): CueHandler => ({
  id,
  label: id,
  path: `/${id}`,
  handler: http.get(`/${id}`, () => HttpResponse.json({})),
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('collectHandlers', () => {
  it('collects default exports', () => {
    const a = make('a')
    expect(collectHandlers({ './a.mock.ts': { default: a } })).toEqual([a])
  })

  it('also collects named exports and arrays', () => {
    const [a, b, c] = [make('a'), make('b'), make('c')]
    const handlers = collectHandlers({ './x.mock.ts': { a, rest: [b, c] } })
    expect(handlers).toEqual([a, b, c])
  })

  it('includes a handler once even if exported as both default and named', () => {
    const a = make('a')
    expect(collectHandlers({ './a.mock.ts': { default: a, a } })).toEqual([a])
  })

  it('sorts by file path', () => {
    const [a, b] = [make('a'), make('b')]
    const handlers = collectHandlers({ './b.mock.ts': { default: b }, './a.mock.ts': { default: a } })
    expect(handlers.map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('warns about files with no handlers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(collectHandlers({ './empty.mock.ts': { helper: 1 } })).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('./empty.mock.ts'))
  })
})
