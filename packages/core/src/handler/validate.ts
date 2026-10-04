import { unrepresentableId, unrepresentableScenario } from '../url/syntax'
import * as log from '../util/log'
import type { CueHandler } from './index'
import { isScenarioHandler } from './scenario'

/**
 * Validates handler definitions — duplicate ids, empty scenario arrays, duplicate scenario names, and ids or
 * scenario names that a `?cue=` link couldn't carry
 *
 * Failures at request time are hard to trace, so everything is checked up front in createCuesheet().
 * @throws with every problem collected, if there is at least one
 */
export function assertValidHandlers(handlers: CueHandler[]): void {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const meta of handlers) {
    if (seen.has(meta.id)) {
      problems.push(`'${meta.id}' is registered more than once, so its state key collides.`)
    }
    seen.add(meta.id)

    const badId = unrepresentableId(meta.id)
    if (badId !== undefined) {
      problems.push(`id '${meta.id}' ${badId}.`)
    }

    if (!isScenarioHandler(meta.handler)) {
      continue
    }
    if (meta.handler.length === 0) {
      problems.push(`'${meta.id}' has an empty scenario array.`)
      continue
    }
    const names = new Set<string>()
    for (const { scenario } of meta.handler) {
      if (names.has(scenario)) {
        problems.push(
          `'${meta.id}' defines scenario '${scenario}' more than once, so selecting it is ambiguous.`,
        )
      }
      names.add(scenario)
      const badName = unrepresentableScenario(scenario)
      if (badName !== undefined) {
        problems.push(`'${meta.id}' scenario '${scenario}' ${badName}.`)
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(log.message(`Invalid handler definitions:\n- ${problems.join('\n- ')}`))
  }
}
