import type { CueRecord, Cuesheet } from 'cuesheet'
import { useSnapshot } from './useSnapshot'

const read = (cuesheet: Cuesheet) => cuesheet.getRecords()
const listen = (cuesheet: Cuesheet, onNext: (records: CueRecord[]) => void) =>
  cuesheet.subscribeRecords(onNext)
// getRecords() copies the list on every call, so compare what's in it
const isSame = (left: CueRecord[], right: CueRecord[]) =>
  left.length === right.length && left.every((record, index) => record === right[index])

/** Subscribes to request records and re-renders when one arrives. Internal to the panel, not exported */
export function useCueRecords(cuesheet: Cuesheet): CueRecord[] {
  return useSnapshot(cuesheet, read, listen, isSame)
}
