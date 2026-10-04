/**
 * The `?cue=` grammar. Kept free of imports so handler validation can share it without a cycle.
 *
 * `?cue=getCoupons:Empty,-redeemCoupon,delay:800-2000,time:2026-01-15T09:00:00Z,offline`
 */
export const CUE_PARAM = 'cue'

export const OFF = 'off'
export const ON = 'on'
export const DELAY = 'delay'
export const TIME = 'time'
export const OFFLINE = 'offline'
export const RUNNING_SUFFIX = '/running'
/** `-getCoupons` turns that handler off. A prefix can't collide with a scenario name the way `id:off` could */
export const DISABLE_PREFIX = '-'
/** Separates entries */
export const ITEM_SEPARATOR = ','
/** Separates a key from its value (`getCoupons:Empty`) */
export const VALUE_SEPARATOR = ':'

/** Words the grammar gives a meaning of its own. A handler with one of these ids couldn't be written in a link */
export const RESERVED_IDS: readonly string[] = [OFF, ON, DELAY, TIME, OFFLINE]

/**
 * Why a handler id can't be written in a `?cue=` link, or `undefined` if it can.
 * The id is followed by `:scenario`, so it can't contain `:` either
 */
export function unrepresentableId(id: string): string | undefined {
  if (id.length === 0) {
    return 'is empty'
  }
  if (RESERVED_IDS.includes(id)) {
    return `is a reserved word in ?${CUE_PARAM}= (${RESERVED_IDS.join(', ')})`
  }
  if (id === '__proto__') {
    return "is '__proto__', which can't be used as a key"
  }
  if (id.startsWith(DISABLE_PREFIX)) {
    return `starts with '${DISABLE_PREFIX}', which turns a handler off in ?${CUE_PARAM}=`
  }
  if (id.includes(ITEM_SEPARATOR) || id.includes(VALUE_SEPARATOR)) {
    return `contains '${ITEM_SEPARATOR}' or '${VALUE_SEPARATOR}', which separate entries in ?${CUE_PARAM}=`
  }
  if (id.trim() !== id) {
    return 'has leading or trailing whitespace, which ?cue= trims'
  }
  return undefined
}

/**
 * Why a scenario name can't be written in a `?cue=` link, or `undefined` if it can.
 * Everything after the first `:` is the name, so `:` itself is fine
 */
export function unrepresentableScenario(name: string): string | undefined {
  if (name.length === 0) {
    return 'is empty'
  }
  if (name.includes(ITEM_SEPARATOR)) {
    return `contains '${ITEM_SEPARATOR}', which separates entries in ?${CUE_PARAM}=`
  }
  if (name.trim() !== name) {
    return `has leading or trailing whitespace, which ?${CUE_PARAM}= trims`
  }
  return undefined
}
