import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Navigation } from './Navigation'

describe('Navigation', () => {
  it('matches the approved cinematic hero navigation', () => {
    render(<Navigation />)

    expect(screen.getByRole('banner')).toBeVisible()
    expect(screen.getByRole('navigation', { name: /museum/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /nanami home/i })).toHaveAttribute(
      'href',
      '#hero',
    )
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute(
      'href',
      '#presence',
    )
    expect(screen.getByRole('link', { name: /field notes/i })).toHaveAttribute(
      'href',
      '#field-notes',
    )
    expect(screen.getByRole('link', { name: 'Photos' })).toHaveAttribute(
      'href',
      '#mood-archive',
    )
    expect(screen.getByRole('link', { name: 'Memes' })).toHaveAttribute(
      'href',
      '#mood-archive',
    )
    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute(
      'href',
      '#mood-archive',
    )
  })
})
