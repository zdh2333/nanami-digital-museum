import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'

describe('Nanami Cat museum shell', () => {
  it('introduces Nanami with the primary museum heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: /one black cat/i }),
    ).toBeVisible()
  })

  it('pairs the hero copy with Nanami’s accessible static portrait initially', () => {
    render(<App />)

    expect(
      screen.getByAltText(
        'Nanami, a black cat with yellow-green eyes and a kinked tail tip',
      ),
    ).toBeVisible()
  })
})
