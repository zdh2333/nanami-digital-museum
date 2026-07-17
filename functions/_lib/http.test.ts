import { describe, expect, it } from 'vitest'
import { TURNSTILE_TEST_SECRET_KEY, turnstileOptions } from './http'

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

  it('allows Cloudflare\'s documented dummy hostname only with the dedicated local test secret', () => {
    expect(turnstileOptions({
      TURNSTILE_TEST_MODE: 'true',
      TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
    })).toEqual({
      expectedHostnames: ['example.com'],
      expectedAction: undefined,
    })

    expect(() => turnstileOptions({
      TURNSTILE_TEST_MODE: 'true',
      TURNSTILE_SECRET_KEY: 'not-the-cloudflare-test-secret',
    })).toThrow('Turnstile test configuration is invalid')
  })
})
