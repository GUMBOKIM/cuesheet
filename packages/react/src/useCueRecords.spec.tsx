import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { type Cuesheet, createCuesheet, HttpResponse, http } from 'cuesheet'
import { afterEach, expect, it } from 'vitest'
import { useCueRecords } from './useCueRecords'

let cuesheet: Cuesheet | undefined

afterEach(() => {
  cleanup()
  cuesheet?.stop()
  cuesheet = undefined
})

function Count({ source }: { source: Cuesheet }) {
  return <p>{`${useCueRecords(source).length} records`}</p>
}

it('re-renders as records arrive and when they are cleared', async () => {
  cuesheet = createCuesheet({
    baseUrl: 'https://api.example.com',
    defaultEnabled: true,
    log: false,
    expose: false,
    handlers: [{ id: 'me', label: 'Me', path: '/me', handler: http.get('/me', () => HttpResponse.json({})) }],
  })
  cuesheet.start()
  render(<Count source={cuesheet} />)
  expect(screen.getByText('0 records')).toBeTruthy()

  await act(async () => {
    await fetch('https://api.example.com/me')
  })
  await waitFor(() => expect(screen.getByText('1 records')).toBeTruthy())

  act(() => cuesheet?.clearRecords())
  expect(screen.getByText('0 records')).toBeTruthy()
})
