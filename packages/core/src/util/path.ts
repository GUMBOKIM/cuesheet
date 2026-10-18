/**
 * Path + query of a request URL, without the origin. Parsed rather than matched with a pattern, so an origin
 * that isn't http(s) — `capacitor://localhost` in a Capacitor WebView, say — is dropped too
 */
export function pathOf(url: string): string {
  try {
    const { pathname, search } = new URL(url)
    return `${pathname}${search}`
  } catch {
    return url
  }
}
