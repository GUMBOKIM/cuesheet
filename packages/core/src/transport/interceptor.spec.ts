import { describe, expect, it, vi } from 'vitest'
import { xhrAbortSignal } from './interceptor'

describe('xhrAbortSignal', () => {
  it('wraps abort() once on a reused XHR and aborts only the current request', () => {
    const native = vi.fn()
    const xhr = { readyState: 1, abort: native } as unknown as XMLHttpRequest

    const first = xhrAbortSignal(xhr)
    const wrapped = xhr.abort
    const second = xhrAbortSignal(xhr)
    expect(xhr.abort).toBe(wrapped)

    xhr.abort()
    expect(second.aborted).toBe(true)
    expect(first.aborted).toBe(false)
    expect(native).toHaveBeenCalledTimes(1)
  })
})
