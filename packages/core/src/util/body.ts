/** Records and logs keep at most this much of a body, so a huge or open-ended one can't fill memory */
const MAX_BYTES = 1024 * 1024

/**
 * How long records and logs wait for a body to finish. A mocked body is in memory and finishes at once; one
 * still going after this is a stream that may never end (NDJSON, token streaming), so what arrived so far is
 * kept and the rest is left unread — the record still appears, and `waitForRequest()` still resolves
 */
const MAX_WAIT_MS = 1000

/**
 * Drops a response copy nobody will read. Not awaited: cancelling one branch of a teed stream only settles once
 * every branch is cancelled, and the app still holds the other one
 */
export function discardBody(response: Response): void {
  response.body?.cancel().catch(() => undefined)
}

/**
 * Reads up to `MAX_BYTES` of a body as text, for at most `MAX_WAIT_MS`. Stops early, cancelling its copy so it
 * doesn't keep the stream alive, if the body is bigger or slower than that
 */
async function readText(source: Request | Response): Promise<{ text: string; truncated: boolean }> {
  const reader = source.body?.getReader()
  if (reader === undefined) {
    return { text: '', truncated: false }
  }
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), MAX_WAIT_MS)
  })
  const stop = () => {
    reader.cancel().catch(() => undefined)
    return { text: text + decoder.decode(), truncated: true }
  }
  try {
    for (;;) {
      const chunk = await Promise.race([reader.read(), timeout])
      if (chunk === 'timeout') {
        return stop()
      }
      if (chunk.done) {
        return { text: text + decoder.decode(), truncated: false }
      }
      // Cut the chunk before decoding it — one chunk can hold the whole (large) body
      const room = MAX_BYTES - bytes
      const value = chunk.value.byteLength > room ? chunk.value.subarray(0, room) : chunk.value
      bytes += value.byteLength
      text += decoder.decode(value, { stream: true })
      if (bytes >= MAX_BYTES) {
        return stop()
      }
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Reads a body in a form suitable for records and logs. Parsed if JSON, otherwise the raw text, truncated */
export async function readBody(source: Request | Response, limit = 2000): Promise<unknown> {
  const { text, truncated } = await readText(source).catch(() => ({ text: '', truncated: false }))
  if (text.length === 0) {
    return undefined
  }
  if (!truncated) {
    try {
      return JSON.parse(text)
    } catch {
      // Not JSON; kept as text below
    }
  }
  return text.length > limit || truncated ? `${text.slice(0, limit)}…` : text
}

/**
 * Reads a response copy for records and logs, or `undefined` for Server-Sent Events. That stream is open-ended
 * by design and its events aren't a body worth keeping, so the copy is dropped at once instead
 */
export async function readResponseBody(response: Response, limit?: number): Promise<unknown> {
  if (response.headers.get('content-type')?.includes('text/event-stream') === true) {
    discardBody(response)
    return undefined
  }
  return await readBody(response, limit)
}
