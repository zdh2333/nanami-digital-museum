import { describe, expect, it } from 'vitest'
import { turnstileOptions } from './http'

const productionHostnames = [
  'nanamicat.com',
  'www.nanamicat.com',
  'nanami-digital-museum.pages.dev',
]

describe('Turnstile hostname configuration', () => {
  it('uses an exact, explicit hostname allowlist', () => {
    expect(turnstileOptions({
      TURNSTILE_EXPECTED_HOSTNAMES: productionHostnames.join(','),
    })).toEqual({
      expectedHostnames: productionHostnames,
      expectedAction: 'guestbook-write',
    })
  })

  it('fails closed for wildcard and unrecognized hostname configuration', () => {
    expect(() => turnstileOptions({
      TURNSTILE_EXPECTED_HOSTNAMES: 'nanamicat.com,*.nanamicat.com',
    })).toThrow('Turnstile hostname configuration is invalid')
  })
})
