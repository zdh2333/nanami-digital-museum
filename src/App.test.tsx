import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'

vi.mock('./components/Hero3D', () => ({
  Hero3D: () => (
    <img
      src="/posters/nanami-hero.webp"
      alt="Nanami, a black cat with yellow-green eyes and a kinked tail tip"
    />
  ),
}))

describe('Nanami Cat museum shell', () => {
  it('introduces Nanami with the primary museum heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'ONE BLACK CAT. MANY MOODS.',
      }),
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

  it('presents the six museum sections in the approved narrative order', () => {
    const { container } = render(<App />)
    const sections = Array.from(container.querySelectorAll('main > section'))

    expect(sections.map((section) => section.id)).toEqual([
      'hero',
      'presence',
      'field-notes',
      'mood-archive',
      'living-archive',
      'closing',
    ])
    sections.forEach((section) => {
      expect(section.querySelectorAll('h1, h2, h3')).toHaveLength(1)
    })
  })

  it('uses the approved living archive copy without mourning language', () => {
    const { container } = render(<App />)

    expect(screen.getByText('She runs the house.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'FIELD NOTES' })).toBeVisible()
    ;[
      'YELLOW-GREEN EYES',
      'RIGHT-ANGLE TAIL',
      'RED COLLAR',
      'ZERO CLOSED DOORS',
    ].forEach((identifier) => {
      expect(screen.getByText(identifier)).toBeVisible()
    })
    expect(screen.getByRole('heading', { name: 'MOOD ARCHIVE' })).toBeVisible()
    expect(screen.getByText('Three collections. Always growing.')).toBeVisible()
    ;['Photos', 'Memes', '3D'].forEach((label) => {
      expect(screen.getByText(label)).toBeVisible()
    })
    expect(screen.getByText('Nanami is probably watching you.')).toBeVisible()
    expect(container.textContent).not.toMatch(
      /memorial|in memory|remembering|rest in peace/i,
    )
  })
})
