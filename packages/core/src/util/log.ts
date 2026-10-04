/** Common prefix for console output. Colored so it stands out from other logs */
const PREFIX = '[cuesheet]'
const PREFIX_STYLE = 'color:#f97316;font-weight:bold'
const RESET_STYLE = 'color:inherit'

export function info(message: string): void {
  console.info(`%c${PREFIX}%c ${message}`, PREFIX_STYLE, RESET_STYLE)
}

export function warn(message: string): void {
  console.warn(`${PREFIX} ${message}`)
}

export function error(message: string, cause?: unknown): void {
  console.error(`${PREFIX} ${message}`, cause)
}

/** Starts a collapsed group with a prefixed title. Must be paired with groupEnd */
export function groupCollapsed(title: string): void {
  console.groupCollapsed(`%c${PREFIX}%c ${title}`, PREFIX_STYLE, RESET_STYLE)
}

export function groupEnd(): void {
  console.groupEnd()
}

export function entry(label: string, value: unknown): void {
  console.log(label, value)
}

/** Adds the prefix to a message for a thrown Error */
export function message(text: string): string {
  return `${PREFIX} ${text}`
}
