import type { HttpHandler } from 'msw'
import { isNil } from '../util/guards'
import * as log from '../util/log'
import type { CueHandler, ScenarioHandler } from './index'

export function isScenarioHandler(handler: CueHandler['handler']): handler is ScenarioHandler[] {
  return Array.isArray(handler)
}

/**
 * Checks that the scenario can be selected. Whether a person or an agent is driving, silently
 * accepting a typo makes "the value you think you set" diverge from "the response actually sent",
 * so this throws and lists the values you can choose from.
 *
 * @throws if the handler doesn't exist, has no scenarios, or the scenario doesn't exist
 */
export function assertSelectable(handlers: CueHandler[], id: string, scenario: string): void {
  const meta = handlers.find((candidate) => candidate.id === id)
  if (isNil(meta)) {
    const ids = handlers.map((candidate) => candidate.id).join(', ')
    throw new Error(log.message(`handler '${id}' not found. Available ids: ${ids}`))
  }
  if (!isScenarioHandler(meta.handler)) {
    throw new Error(log.message(`handler '${id}' has no scenarios.`))
  }
  if (!meta.handler.some((candidate) => candidate.scenario === scenario)) {
    const names = meta.handler.map((candidate) => candidate.scenario).join(', ')
    throw new Error(log.message(`handler '${id}' has no scenario '${scenario}'. Available: ${names}`))
  }
}

/**
 * What a handler answers with: for a scenario array, the selected scenario or the first one if it doesn't
 * exist, along with its name; for a single-response handler, that handler and no name
 */
export function selectHandler(
  meta: CueHandler,
  selected?: string,
): { handler: HttpHandler; scenario?: string } {
  if (!isScenarioHandler(meta.handler)) {
    return { handler: meta.handler }
  }
  const matched = meta.handler.find((candidate) => candidate.scenario === selected) ?? meta.handler[0]
  if (isNil(matched)) {
    throw new Error(log.message(`handler '${meta.id}' has an empty scenario list`))
  }
  return { handler: matched.handler, scenario: matched.scenario }
}
