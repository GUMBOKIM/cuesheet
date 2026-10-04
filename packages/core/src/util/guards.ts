export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

/** Whether we're in a browser context. Guards window access during SSR and tests */
export function isClient(): boolean {
  return typeof window !== 'undefined'
}
