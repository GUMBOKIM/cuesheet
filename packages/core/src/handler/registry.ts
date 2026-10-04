/**
 * Handler id → selectable scenario names. Empty by default, so both ids and scenarios are `string`.
 *
 * Fill it in yourself via declaration merging, from your handler files. Once filled,
 * typos like `select('getCoupons', 'Emtpy')` are caught by the type checker instead of at runtime.
 *
 * ```ts
 * declare module 'cuesheet' {
 *   interface CueRegistry {
 *     getCoupons: 'OK' | 'Empty'
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: filled in via declaration merging
export interface CueRegistry {}

/** Registered handler ids. `string` if the registry is empty */
export type HandlerId = [keyof CueRegistry] extends [never] ? string : Extract<keyof CueRegistry, string>

/** Scenario names of a handler. `string` for ids not in the registry */
export type ScenarioOf<Id extends string> = Id extends keyof CueRegistry ? CueRegistry[Id] : string

/** Every registered scenario name, of any handler. `string` if the registry is empty */
export type ScenarioName = ScenarioOf<HandlerId>

/**
 * Arguments of `select()`: a union of tuples pairing each id with its own scenarios.
 * With `(id: Id, scenario: ScenarioOf<Id>)`, a union id would widen the scenario to a union too,
 * letting another handler's scenario through. `[string, string]` if the registry is empty
 */
export type SelectArgs = { [Id in HandlerId]: [id: Id, scenario: ScenarioOf<Id>] }[HandlerId]
