import { BatchInterceptor, getRawRequest } from '@mswjs/interceptors'
import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest'

export type CueInterceptor = BatchInterceptor<[FetchInterceptor, XMLHttpRequestInterceptor]>

/**
 * Creates an interceptor that monkey-patches fetch / XHR.
 *
 * Why not a service worker: the release WebView of Capacitor apps blocks service worker
 * fetch interception (ionic-team/capacitor#7069). Using a SW on the web only would split the transport
 * in two, so a single monkey patch that works in both places is used instead.
 *
 * axios uses the XHR adapter in the browser, so it is intercepted as is. Requests made by `<img>` or CSS
 * aren't fetch / XHR, so they can't be intercepted.
 */
export function createInterceptor(): CueInterceptor {
  return new BatchInterceptor({
    name: 'cuesheet-interceptor',
    interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()],
  })
}

function isXhr(value: unknown): value is XMLHttpRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'readyState' in value &&
    typeof (value as XMLHttpRequest).abort === 'function'
  )
}

/** The controller for the request an XHR is currently sending. An XHR can be reused for several requests */
const current = new WeakMap<XMLHttpRequest, AbortController>()

/**
 * A signal that fires when `abort()` is called on this XHR for its current request. `abort()` is wrapped the
 * first time only; later requests on the same XHR swap in their own controller
 */
export function xhrAbortSignal(xhr: XMLHttpRequest): AbortSignal {
  const controller = new AbortController()
  if (!current.has(xhr)) {
    const abort = xhr.abort
    xhr.abort = () => {
      current.get(xhr)?.abort(new DOMException('The request was aborted.', 'AbortError'))
      abort.call(xhr)
    }
  }
  current.set(xhr, controller)
  return controller.signal
}

/**
 * A signal that fires when the app gives up on the request. fetch carries one on the Request. For XHR the
 * interceptor gives the Request no signal and doesn't forward `xhr.abort()` either, so that is wrapped to
 * raise one (axios cancellation goes through `abort()` too)
 */
export function abortSignalOf(request: Request): AbortSignal {
  const raw = getRawRequest(request)
  return isXhr(raw) ? xhrAbortSignal(raw) : request.signal
}
