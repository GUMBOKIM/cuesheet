import type { CuesheetOptions } from './createCuesheet'

/**
 * What a project's setup module supplies: everything `createCuesheet` takes except the handlers, which come
 * from the handler files. Every field is optional.
 */
export type CueSetup = Partial<Omit<CuesheetOptions, 'handlers'>>

/**
 * Types the default export of a setup module. It only returns what it's given; the point is that the fields
 * are checked and completed as you write them.
 *
 * ```ts
 * // src/mocks/cuesheet.ts
 * export default defineCuesheet({ baseUrl: 'https://api.example.com' })
 * ```
 */
export function defineCuesheet(setup: CueSetup): CueSetup {
  return setup
}
