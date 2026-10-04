import type { CueState, Cuesheet } from 'cuesheet'
import { useSnapshot } from './useSnapshot'

const read = (cuesheet: Cuesheet) => cuesheet.getState()
const listen = (cuesheet: Cuesheet, onNext: (state: CueState) => void) => cuesheet.subscribe(onNext)
// getState() returns the same object until the state changes
const isSame = (left: CueState, right: CueState) => left === right

/** Subscribes to cuesheet state and re-renders when it changes. Internal to the panel, not exported */
export function useCueState(cuesheet: Cuesheet): CueState {
  return useSnapshot(cuesheet, read, listen, isSame)
}
