import { readBody, readResponseBody } from '../../util/body'
import * as log from '../../util/log'
import { pathOf } from '../../util/path'
import type { CuePlugin } from '../context'

/**
 * Logs intercepted requests to the console.
 *
 * Requests answered by cuesheet never reach the real network, so they don't show up in the
 * DevTools Network panel. This leaves a trace in the console instead.
 */
export const httpLogger: CuePlugin = {
  async onResponse(context, response) {
    const elapsed = Math.round(performance.now() - context.startedAt)
    const { method, url } = context.request
    const path = pathOf(url)
    // A scenario returning `HttpResponse.error()` fails the app's fetch, so it is logged as the failure it is
    if (response.type === 'error') {
      log.warn(`${method} ${path} → failed (Network error)`)
      return
    }
    // Side by side, so a slow request body and a slow response body don't add up
    const [payload, body] = await Promise.all([
      readBody(context.request.clone(), 500),
      readResponseBody(response, 500),
    ])

    log.groupCollapsed(`${method} ${path} → ${response.status} (${elapsed}ms)`)
    if (payload !== undefined) {
      log.entry('payload: ', payload)
    }
    log.entry('response:', body)
    log.groupEnd()
  },

  onError(context, error) {
    const path = pathOf(context.request.url)
    log.warn(`${context.request.method} ${path} → failed (${error.message})`)
  },
}
