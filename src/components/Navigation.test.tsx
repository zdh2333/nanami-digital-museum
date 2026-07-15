import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Navigation } from './Navigation'

describe('Navigation', () => {
  it('exposes semantic section links and the archive action', () => {
    render(<Navigation />)

    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByRole('navigation', { name: /museum/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /nanami cat home/i })).toHaveAttribute(
      'href',
      '#top',
    )
    expect(screen.getByRole('link', { name: /presence/i })).toHaveAttribute(
      'href',
      '#presence',
    )
    expect(screen.getByRole('link', { name: /field notes/i })).toHaveAttribute(
      'href',
      '#field-notes',
    )
    expect(screen.getByRole('link', { name: /mood archive/i })).toHaveAttribute(
      'href',
      '#mood-archive',
    )
  })
})
