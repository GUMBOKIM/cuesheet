import { act, cleanup, render, screen } from '@testing-library/react'
import { createCuesheet } from 'cuesheet'
import { useLayoutEffect } from 'react'
import { afterEach, expect, it } from 'vitest'
import { useCueState } from './useCueState'

afterEach(() => {
  cleanup()
})

function Enabled({ cuesheet }: { cuesheet: ReturnType<typeof createCuesheet> }) {
  return <p>{String(useCueState(cuesheet).enabled)}</p>
}

const make = (enabled: boolean) =>
  createCuesheet({ handlers: [], defaultEnabled: enabled, log: false, expose: false })

it('re-renders when the state changes', () => {
  const cuesheet = make(true)
  render(<Enabled cuesheet={cuesheet} />)
  act(() => cuesheet.patch({ enabled: false }))
  expect(screen.getByText('false')).toBeTruthy()
})

it("reads the new instance's state when the instance changes", () => {
  const { rerender } = render(<Enabled cuesheet={make(true)} />)
  expect(screen.getByText('true')).toBeTruthy()
  rerender(<Enabled cuesheet={make(false)} />)
  expect(screen.getByText('false')).toBeTruthy()
})

it('catches a change made between render and subscription', () => {
  const cuesheet = make(true)
  // Layout effects run before the hook subscribes, so no notification reaches it for this change
  function TurnOff() {
    useLayoutEffect(() => {
      cuesheet.patch({ enabled: false })
    }, [])
    return null
  }
  render(
    <>
      <Enabled cuesheet={cuesheet} />
      <TurnOff />
    </>,
  )
  expect(screen.getByText('false')).toBeTruthy()
})
