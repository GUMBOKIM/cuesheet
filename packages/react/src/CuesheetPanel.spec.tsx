import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { type CueHandler, type CueStorage, createCuesheet } from 'cuesheet'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CuesheetPanel } from './CuesheetPanel'

const handlers: CueHandler[] = [
  {
    id: 'getBusinesses',
    label: 'Business list',
    path: '/businesses',
    pages: ['/home'],
    handler: [
      { scenario: 'ok', handler: http.get('/businesses', () => HttpResponse.json([{ id: 1 }])) },
      { scenario: 'empty list', handler: http.get('/businesses', () => HttpResponse.json([])) },
    ],
  },
  {
    id: 'getUser',
    label: 'My profile',
    path: '/users/me',
    handler: http.get('/users/me', () => HttpResponse.json({ id: 7 })),
  },
]

function setup({
  storage,
  ...props
}: {
  pathname?: string | undefined
  onChange?: () => void
  storage?: CueStorage
} = {}) {
  const cuesheet = createCuesheet({
    handlers,
    baseUrl: 'https://api.example.com',
    defaultEnabled: true,
    log: false,
    expose: false,
    ...(storage === undefined ? {} : { storage }),
  })
  render(<CuesheetPanel cuesheet={cuesheet} {...props} />)
  return cuesheet
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('CuesheetPanel', () => {
  it('shows only the launcher at first and opens on click', () => {
    setup()
    expect(screen.queryByText('Business list')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    expect(screen.getByText('Business list')).toBeTruthy()
    expect(screen.getByText('My profile')).toBeTruthy()
  })

  it('shows the version and a feedback link that opens in a new tab', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    expect(screen.getByText(__CUESHEET_VERSION__)).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Feedback ↗' }) as HTMLAnchorElement
    expect(link.href).toBe('https://github.com/GUMBOKIM/cuesheet/discussions')
    expect(link.target).toBe('_blank')
  })

  it('remembers the open state in the store the instance uses', async () => {
    window.localStorage.setItem('cuesheet:panel-open', 'true')
    setup({ storage: window.localStorage })
    expect(await screen.findByText('Business list')).toBeTruthy()
  })

  it('follows the instance to another store instead of reaching for localStorage', async () => {
    const map = new Map<string, string>([['cuesheet:panel-open', 'true']])
    const storage: CueStorage = {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => {
        map.set(key, value)
      },
    }
    setup({ storage })
    expect(await screen.findByText('Business list')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(map.get('cuesheet:panel-open')).toBe('false')
    expect(window.localStorage.getItem('cuesheet:panel-open')).toBeNull()
  })

  it('remembers it through a store that answers asynchronously, such as IndexedDB', async () => {
    const map = new Map<string, string>([['cuesheet:panel-open', 'true']])
    const storage: CueStorage = {
      getItem: (key) => Promise.resolve(map.get(key) ?? null),
      setItem: async (key, value) => {
        map.set(key, value)
      },
    }
    setup({ storage })
    // Nothing is open before the store answers; a moment later the panel is back as it was left
    expect(screen.queryByText('Business list')).toBeNull()
    expect(await screen.findByText('Business list')).toBeTruthy()
  })

  it('reflects the master toggle in the state', () => {
    const cuesheet = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const master = screen.getByRole('checkbox', { name: 'cuesheet on/off' }) as HTMLInputElement
    expect(master.checked).toBe(true)
    fireEvent.click(master)
    expect(cuesheet.getState().enabled).toBe(false)
  })

  it('changes the state when a scenario is picked', () => {
    const cuesheet = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const scenario = screen
      .getAllByRole('combobox')
      .find((element) => element.textContent?.includes('empty list'))
    fireEvent.change(scenario as HTMLSelectElement, { target: { value: 'empty list' } })
    expect(cuesheet.getState().api.getBusinesses?.scenario).toBe('empty list')
  })

  it('filters the list by search text', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    fireEvent.change(screen.getByPlaceholderText('Search APIs (name, path)'), {
      target: { value: 'users' },
    })
    expect(screen.queryByText('Business list')).toBeNull()
    expect(screen.getByText('My profile')).toBeTruthy()
  })

  it("shows this page's APIs first when pathname is given", () => {
    setup({ pathname: '/settings' })
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    // getBusinesses has pages: ['/home'] so it's filtered out; shared APIs without pages remain
    expect(screen.queryByText('Business list')).toBeNull()
    expect(screen.getByText('My profile')).toBeTruthy()
  })

  it('matches pages by path segment, not by prefix', () => {
    const paged: CueHandler[] = [
      {
        id: 'getHome',
        label: 'Home feed',
        path: '/feed',
        pages: ['/'],
        handler: http.get('/feed', () => HttpResponse.json([])),
      },
      {
        id: 'getCheck',
        label: 'Check status',
        path: '/check',
        pages: ['/check'],
        handler: http.get('/check', () => HttpResponse.json({})),
      },
    ]
    const cuesheet = createCuesheet({ handlers: paged, defaultEnabled: true, log: false, expose: false })
    const { rerender } = render(<CuesheetPanel cuesheet={cuesheet} pathname="/checkout" />)
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    // '/' is the home page only, and '/check' doesn't cover '/checkout'
    expect(screen.queryByText('Home feed')).toBeNull()
    expect(screen.queryByText('Check status')).toBeNull()

    rerender(<CuesheetPanel cuesheet={cuesheet} pathname="/check/42" />)
    expect(screen.getByText('Check status')).toBeTruthy()
    expect(screen.queryByText('Home feed')).toBeNull()
  })

  it('keeps a handler whose pages are empty under the page filter', async () => {
    // `pages: []` means "no pages given", which is how the Common/This page grouping already reads it.
    // The filter used to read it as "belongs to no page" and hide the handler from the list entirely
    const empty: CueHandler[] = [
      {
        id: 'getUser',
        label: 'My profile',
        path: '/users/me',
        pages: [],
        handler: http.get('/users/me', () => HttpResponse.json({ id: 7 })),
      },
    ]
    const cuesheet = createCuesheet({ handlers: empty, defaultEnabled: true, log: false, expose: false })
    render(<CuesheetPanel cuesheet={cuesheet} pathname="/settings" />)
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    expect(screen.getByText('My profile')).toBeTruthy()
  })

  it('calls onChange when the state changes', () => {
    const onChange = vi.fn()
    setup({ onChange })
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable all' }))
    expect(onChange).toHaveBeenCalled()
  })

  it('applies turn all off/on to every handler', () => {
    const cuesheet = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable all' }))
    expect(cuesheet.getState().api.getUser?.enabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Enable all' }))
    expect(cuesheet.getState().api.getUser?.enabled).toBe(true)
  })

  it('turn all off/on touches only the handlers — the master switch, clock and scenarios stay', () => {
    const cuesheet = setup()
    cuesheet.select('getBusinesses', 'empty list')
    cuesheet.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disable all' }))
    expect(cuesheet.getState().enabled).toBe(true)
    expect(cuesheet.getState().time).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Enable all' }))
    expect(cuesheet.getState().api.getBusinesses).toEqual({ enabled: true, scenario: 'empty list' })
  })

  it('still works where storage is denied', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    try {
      setup()
      fireEvent.click(screen.getByRole('button', { name: 'cue' }))
      expect(screen.getByText('Business list')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByText('Business list')).toBeNull()
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})

describe('Clock', () => {
  it('keeps seconds when the time field is shown and edited', () => {
    const cuesheet = setup()
    cuesheet.patch({ time: { now: new Date(2026, 0, 31, 23, 59, 59).toISOString(), mode: 'frozen' } })
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const field = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    expect(field.value).toBe('2026-01-31T23:59:59')
    fireEvent.change(field, { target: { value: '2026-02-01T00:00:01' } })
    expect(cuesheet.getState().time?.now).toBe(new Date(2026, 1, 1, 0, 0, 1).toISOString())
  })

  it('keeps the clock while a segment of the field is half typed', () => {
    const cuesheet = setup()
    const time = { now: new Date(2026, 0, 15, 9, 0, 0).toISOString(), mode: 'running' as const }
    cuesheet.patch({ time })
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const field = document.querySelector('input[type="datetime-local"]') as HTMLInputElement
    // What the browser reports after the hour is backspaced
    fireEvent.change(field, { target: { value: '' } })
    expect(cuesheet.getState().time).toEqual(time)
  })
})

describe('Copy URL', () => {
  it('shows the URL to copy by hand when copying is not possible', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const execCommand = vi.fn(() => false)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    try {
      const cuesheet = setup()
      cuesheet.select('getBusinesses', 'empty list')
      fireEvent.click(screen.getByRole('button', { name: 'cue' }))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }))
      })
      expect(execCommand).toHaveBeenCalledWith('copy')
      const field = screen.getByRole('textbox', { name: 'URL to copy' }) as HTMLInputElement
      expect(field.value).toBe(cuesheet.toShareUrl())
    } finally {
      vi.unstubAllGlobals()
      Reflect.deleteProperty(document, 'execCommand')
    }
  })
})

describe('request log', () => {
  it('shows a hint when there are no records', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    expect(screen.getByText('Requests answered by cuesheet show up here.')).toBeTruthy()
  })

  it('lists incoming requests and can clear them', async () => {
    const cuesheet = setup()
    cuesheet.start()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))

    await act(async () => {
      await fetch('https://api.example.com/users/me')
    })

    // The path also appears in catalog entries, so check only within the record list.
    // A record lands once its bodies are read, a moment after the response
    await waitFor(() => expect(document.querySelectorAll('.cue-record')).toHaveLength(1))
    expect(document.querySelector('.cue-record-path')?.textContent).toBe('/users/me')
    expect(document.querySelector('.cue-record-status')?.textContent).toBe('200')

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(document.querySelectorAll('.cue-record')).toHaveLength(0)
    cuesheet.stop()
  })
})

describe('Controls', () => {
  it('the delay sliders keep min at or below max', () => {
    const cuesheet = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const [min, max] = document.querySelectorAll<HTMLInputElement>('input[type="range"]')
    fireEvent.change(max as HTMLInputElement, { target: { value: '800' } })
    fireEvent.change(min as HTMLInputElement, { target: { value: '1200' } })
    expect(cuesheet.getState().delay).toEqual({ min: 1200, max: 1200 })
  })

  it('the offline switch toggles the network', () => {
    const cuesheet = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const offline = screen.getByText('Offline').closest('label')?.querySelector('input') as HTMLInputElement
    fireEvent.click(offline)
    expect(cuesheet.getState().network.offline).toBe(true)
  })

  it('the clock mode and Reset change the time condition', () => {
    const cuesheet = setup()
    cuesheet.patch({ time: { now: '2026-01-31T09:00:00.000Z', mode: 'frozen' } })
    fireEvent.click(screen.getByRole('button', { name: 'cue' }))
    const mode = screen.getByDisplayValue('Frozen') as HTMLSelectElement
    fireEvent.change(mode, { target: { value: 'running' } })
    expect(cuesheet.getState().time?.mode).toBe('running')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(cuesheet.getState().time).toBeNull()
  })
})

describe('inside a shadow root', () => {
  it('takes its own copy of the styles in, since the document sheet cannot reach inside', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const mount = document.createElement('div')
    shadow.appendChild(mount)
    const cuesheet = createCuesheet({ handlers, defaultEnabled: true, log: false, expose: false })
    render(<CuesheetPanel cuesheet={cuesheet} />, { container: mount })

    const style = shadow.querySelector('style')
    expect(style).not.toBeNull()
    expect(style?.textContent).toContain('.cue-launcher')
  })

  it('a click inside the panel does not count as a click outside', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const mount = document.createElement('div')
    shadow.appendChild(mount)
    const cuesheet = createCuesheet({ handlers, defaultEnabled: true, log: false, expose: false })
    render(<CuesheetPanel cuesheet={cuesheet} />, { container: mount })

    const launcher = shadow.querySelector('.cue-launcher') as HTMLButtonElement
    fireEvent.click(launcher)
    const search = shadow.querySelector('input[type="search"]') as HTMLInputElement
    act(() => {
      search.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    })
    expect(shadow.querySelector('.cue-panel')).not.toBeNull()

    act(() => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    })
    expect(shadow.querySelector('.cue-panel')).toBeNull()
    host.remove()
  })
})
