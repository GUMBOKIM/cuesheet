import { readBody, readResponseBody } from '../../util/body'
import * as log from '../../util/log'
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
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    const payload = await readBody(context.request.clone(), 500)
    const body = await readResponseBody(response, 500)

    log.groupCollapsed(`${method} ${path} → ${response.status} (${elapsed}ms)`)
    if (payload !== undefined) {
      log.entry('payload: ', payload)
    }
    log.entry('response:', body)
    log.groupEnd()
  },

  onError(context, error) {
    const path = context.request.url.replace(/^https?:\/\/[^/]+/, '')
    log.warn(`${context.request.method} ${path} → failed (${error.message})`)
  },
}
