import type { Cuesheet } from 'cuesheet'
import { useEffect, useRef, useState } from 'react'

/**
 * The Clipboard API exists only in secure contexts, so it's missing when the app is opened over plain HTTP
 * (e.g. `http://192.168.0.5:5173` on a phone). The older `execCommand('copy')` still works there
 */
function copyWithSelection(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Denied; try the older way
  }
  return copyWithSelection(text)
}

type Status = 'idle' | 'copied' | 'failed'

/**
 * Copies a URL (`?cue=...`) that reproduces the current state exactly. It hands the state to someone else rather
 * than changing a setting, so it sits at the top, apart from the settings list.
 * If copying isn't possible at all, it shows the URL so it can be copied by hand
 */
export function CopyUrlButton({ cuesheet }: { cuesheet: Cuesheet }) {
  const [status, setStatus] = useState<Status>('idle')
  const [url, setUrl] = useState('')
  const fallback = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status !== 'copied') {
      return
    }
    const timer = setTimeout(() => setStatus('idle'), 1500)
    return () => clearTimeout(timer)
  }, [status])

  // Select the URL once when the field appears, not on every render — that would undo the user's own selection
  useEffect(() => {
    if (status === 'failed') {
      fallback.current?.select()
    }
  }, [status])

  async function copy() {
    const next = cuesheet.toShareUrl()
    setUrl(next)
    setStatus((await copyText(next)) ? 'copied' : 'failed')
  }

  return (
    <>
      <button
        type="button"
        className="cue-btn cue-btn-success cue-copy"
        title="Copy a URL that opens the app in this exact state"
        onClick={copy}
      >
        {status === 'copied' ? 'Copied!' : 'Copy URL'}
      </button>
      {status === 'failed' && (
        <input
          className="cue-input cue-copy-fallback"
          aria-label="URL to copy"
          readOnly
          value={url}
          ref={fallback}
          onFocus={(event) => event.target.select()}
        />
      )}
    </>
  )
}
