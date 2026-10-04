/** The dev server port. Give each worktree its own with `PORT=…` when running several at once */
export const PORT = Number(process.env.PORT ?? 5174)

/** Something only this example serves */
const MARKER = 'Coupons — cuesheet example'

/**
 * `reuseExistingServer` attaches to whatever already answers on the port, and Playwright only checks that
 * something does — not what. On a machine where another app happens to own the port (another worktree, a
 * dev server of your own), the whole suite would silently run against that app and fail in confusing ways.
 * This checks it really is this example before any test starts.
 */
export default async function verifyServer(): Promise<void> {
  const url = `http://localhost:${PORT}/`
  const html = await fetch(url).then((response) => response.text())
  if (!html.includes(MARKER)) {
    throw new Error(
      `${url} is serving something other than the cuesheet react example — no '${MARKER}' in its HTML. ` +
        `Stop whatever is using port ${PORT}, or run the tests with PORT=<a free port>.`,
    )
  }
}
