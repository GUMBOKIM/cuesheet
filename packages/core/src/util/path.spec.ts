import { expect, it } from 'vitest'
import { pathOf } from './path'

it('keeps the path and query and drops the origin', () => {
  expect(pathOf('https://api.example.com/businesses?page=2')).toBe('/businesses?page=2')
})

it('drops an origin that is not http(s), such as a Capacitor WebView', () => {
  expect(pathOf('capacitor://localhost/coupons?x=1')).toBe('/coupons?x=1')
})
