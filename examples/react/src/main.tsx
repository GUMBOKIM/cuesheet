import type { Cuesheet } from 'cuesheet'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

/**
 * Starts cuesheet before the first render, so the first request and the clock condition are never missed.
 * `import.meta.env.DEV` is false in `vite build`, so the dynamic import — and everything behind it — is dropped
 */
async function startCuesheet(): Promise<Cuesheet | undefined> {
  if (!import.meta.env.DEV) {
    return undefined
  }
  const { cuesheet } = await import('./mocks/cuesheet')
  return cuesheet
}

void startCuesheet().then((cuesheet) => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App cuesheet={cuesheet} />
    </StrictMode>,
  )
})
