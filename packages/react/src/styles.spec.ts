import { afterEach, expect, it } from 'vitest'
import { injectStyles } from './styles'

afterEach(() => {
  document.head.querySelectorAll('style').forEach((style) => {
    style.remove()
  })
  document.body.innerHTML = ''
})

it('injects once into the document head', () => {
  injectStyles()
  injectStyles()
  expect(document.head.querySelectorAll('style')).toHaveLength(1)
})

it('injects into a shadow root when given one, where head styles would not reach', () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: 'open' })
  injectStyles(shadow)
  injectStyles(shadow)
  expect(shadow.querySelectorAll('style')).toHaveLength(1)
  expect(document.head.querySelectorAll('style')).toHaveLength(0)
})
