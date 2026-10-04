import { isNil } from '../util/guards'
import * as log from '../util/log'
import type { CuePlugin, CueRequestContext, CueResolution } from './context'
import { abortSignalOf, type CueInterceptor, createInterceptor } from './interceptor'

export type { CuePlugin, CueRequestContext, CueResolution, CueResolutionMeta } from './context'
export { httpLogger } from './plugins/httpLogger'

export interface CueTransport {
  /** Starts intercepting fetch / XHR. Calling it more than once has no extra effect */
  start(): void
  /** Stops intercepting and restores the original fetch / XHR */
  stop(): void
}

interface TransportOptions {
  /**
   * Decides how to handle a single request. A returned response is used as is;
   * `undefined` bypasses to the real network. Called on every request, so state changes take effect immediately.
   * `signal` fires when the app gives up on the request (fetch and XHR alike), so waiting can stop early
   */
  resolve(request: Request, signal: AbortSignal): Promise<CueResolution | undefined>
  plugins: CuePlugin[]
}

/** Isolates plugins so one failing doesn't stop request handling or the other plugins */
async function runPlugins<T>(
  plugins: CuePlugin[],
  run: (plugin: CuePlugin, index: number) => Promise<T> | T,
): Promise<(T | undefined)[]> {
  return await Promise.all(
    plugins.map(async (plugin, index) => {
      try {
        return await run(plugin, index)
      } catch (cause) {
        log.error('A plugin threw', cause)
        return undefined
      }
    }),
  )
}

/**
 * fetch / XHR interception and the request pipeline. Each request completes in a single flow:
 * `onRequest → resolve → response → onResponse`.
 *
 * The response goes to the app before `onResponse` runs, so a plugin reading the body (records, logs) can
 * never hold it back — a streaming response reaches the app as it streams, even if it never ends.
 *
 * This layer knows nothing about handlers or the state shape. It only takes a `resolve` function.
 */
export function createTransport({ resolve, plugins }: TransportOptions): CueTransport {
  let interceptor: CueInterceptor | undefined

  function start(): void {
    if (!isNil(interceptor)) {
      return
    }
    interceptor = createInterceptor()
    interceptor.on('request', async ({ request, requestId, controller }) => {
      const context: CueRequestContext = { requestId, request, startedAt: performance.now() }
      const signal = abortSignalOf(request)
      const carried = await runPlugins(plugins, (plugin) => plugin.onRequest?.(context))

      // If resolve throws, fall back to bypass — cuesheet must never break the app's requests
      const resolution = await resolve(request, signal).catch((cause) => {
        log.error('Failed to handle request — bypassing', cause)
        return undefined
      })
      // The app gave up while cuesheet was deciding (during the delay, say). The interceptor has already failed
      // an aborted fetch. An aborted XHR it knows nothing about: answering would fire `load` on it, and leaving
      // it unanswered would send it to the real network, so it is failed here
      if (signal.aborted) {
        if (signal !== request.signal) {
          await controller.errorWith(signal.reason as Error)
        }
        return
      }
      if (isNil(resolution)) {
        return
      }

      context.meta = resolution.meta

      const { error, response } = resolution
      if (!isNil(error)) {
        // The failure reaches the app first, as a response does below
        await controller.errorWith(error)
        await runPlugins(plugins, (plugin, index) => plugin.onError?.(context, error, carried[index]))
        return
      }
      if (isNil(response)) {
        return
      }

      // Each plugin with onResponse gets its own copy, taken before the original is handed over. A copy that is
      // neither read nor cancelled buffers everything a stream sends, so plugins must do one or the other
      const copies = plugins.map((plugin) => (plugin.onResponse === undefined ? undefined : response.clone()))
      await controller.respondWith(response)
      await runPlugins(plugins, (plugin, index) =>
        plugin.onResponse?.(context, copies[index] as Response, carried[index]),
      )
    })
    interceptor.apply()
  }

  function stop(): void {
    interceptor?.dispose()
    interceptor = undefined
  }

  return { start, stop }
}
