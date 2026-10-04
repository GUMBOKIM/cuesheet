/** Which handler answered a request, for plugins */
export interface CueResolutionMeta {
  handlerId: string
  /** The scenario that answered. Absent for single-response handlers */
  scenario?: string
}

/** Information shared by plugins while a single request is handled */
export interface CueRequestContext {
  readonly requestId: string
  readonly request: Request
  /** When interception started (performance.now) */
  readonly startedAt: number
  /** Which handler answered. Set before `onResponse` / `onError`; `undefined` when no handler did (offline) */
  meta?: CueResolutionMeta | undefined
}

/** What `resolve` returns: a response or an error, plus extra information for plugins */
export interface CueResolution {
  /** The response to return */
  response?: Response
  /** Set to fail the request. Takes precedence over `response` */
  error?: Error
  meta?: CueResolutionMeta | undefined
}

/**
 * A plugin that hooks into request handling. Whatever `onRequest` returns is passed straight to `onResponse`,
 * so no storage is needed to remember the request between the two stages.
 *
 * `onRequest` runs for every intercepted request, including ones that end up going to the real network, so it
 * should stay cheap. `onResponse` is called only for requests cuesheet answered, after the app already has the
 * response. It is not called for bypassed requests. Read request bodies there, from `context.request.clone()`.
 */
export interface CuePlugin {
  onRequest?(context: CueRequestContext): Promise<unknown> | unknown
  onResponse?(context: CueRequestContext, response: Response, carried: unknown): Promise<void> | void
  /** When cuesheet failed the request (offline, etc.) */
  onError?(context: CueRequestContext, error: Error, carried: unknown): Promise<void> | void
}
