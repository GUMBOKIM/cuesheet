import type { CueEntry } from './handler'
import type { CueState } from './state'

/** Where the full guide lives once the package is installed */
export const GUIDE_PATH = 'node_modules/cuesheet/AGENTS.md'

/**
 * A plain-text cheat sheet for whoever finds `window.__cuesheet__` — mostly agents poking at the page.
 * Carries the live catalog and state, so it answers "what can I control, and what is it set to now"
 * in one call.
 */
export function renderHelp(
  catalog: Record<string, CueEntry>,
  state: CueState,
  shareParam: string,
  /** How to reach this instance — the global it's exposed under */
  handle: string,
): string {
  const handlers = Object.entries(catalog).map(([id, entry]) => {
    const setting = state.api[id]
    const fallback = entry.scenarios?.[0]?.value
    // An enabled handler with nothing selected answers with its first scenario, so name it
    const selected = setting?.scenario ?? (fallback === undefined ? 'on' : `${fallback} (default)`)
    const current = !state.enabled
      ? `real server — cuesheet is off (${setting?.enabled === true ? selected : 'handler off'} once it's on)`
      : setting?.enabled !== true
        ? 'off (goes to the real server)'
        : selected
    const scenarios = entry.scenarios?.map((scenario) => scenario.value).join(' | ') ?? '(single response)'
    return `  ${id}  ${entry.method.toUpperCase()} ${entry.path}\n    scenarios: ${scenarios}\n    now: ${current}`
  })

  return `cuesheet decides this app's API responses, delay, clock and network.

Enter a state (most reliable — set the clock this way):
  ?cue=on,<handlerId>:<scenario>,delay:800-2000,time:2026-01-15T09:00:00Z,offline
  Anything left out starts from the defaults. -<handlerId> turns one handler off (its requests go to the
  real server). ?cue=off turns cuesheet off.

Change it after entering:
  ${handle}.select('<handlerId>', '<scenario>')   throws with the valid values on a typo
  ${handle}.patch({ network: { offline: true } })
  ${handle}.reset()

See what the app sent:
  ${handle}.getRecords({ handlerId: '<handlerId>' })     also { scenario, method, path, status, failed }
  await ${handle}.waitForRequest({ handlerId: '<handlerId>' })

State now: ?cue=${shareParam}

Handlers:
${handlers.length > 0 ? handlers.join('\n') : '  (none registered)'}

Full guide: ${GUIDE_PATH}
`
}
