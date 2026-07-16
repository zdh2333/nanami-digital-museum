import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'

vi.mock('./components/Hero3D', () => ({
  Hero3D: () => <div data-testid="legacy-3d-hero" />,
}))

describe('Nanami Cat museum shell', () => {
  it('introduces Nanami with the primary museum heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'ONE BLACK CAT. MANY MOODS.',
      }),
    ).toBeInTheDocument()
  })

  it('uses the approved cinematic Nanami hero artwork instead of the legacy 3D hero', () => {
    const { container } = render(<App />)

    const portrait = screen.getByAltText(
      'Nanami sitting in a dark room and looking directly at the camera.',
    )
    expect(portrait).toBeVisible()
    expect(portrait).toHaveAttribute('src', '/hero/nanami-cinematic-hero.webp')
    expect(portrait).toHaveAttribute('fetchpriority', 'high')
    expect(screen.queryByTestId('legacy-3d-hero')).not.toBeInTheDocument()
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('shows a reviewed Nanami room photograph in the presence chapter', () => {
    render(<App />)

    const presence = document.querySelector('#presence')
    expect(presence).not.toBeNull()
    const roomPortrait = within(presence as HTMLElement).getByAltText(
      'Nanami standing at the edge of a bed and looking directly at the camera.',
    )
    expect(roomPortrait).toHaveAttribute(
      'src',
      '/archive/photos/nanami-photo-002-640.webp',
    )
    expect(roomPortrait).toHaveAttribute(
      'srcset',
      expect.stringContaining('nanami-photo-002-1600.webp'),
    )
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
      expect(section).toHaveClass('anchor-target')
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
    ;['Photos', 'Memes', 'Portraits'].forEach((label) => {
      expect(screen.getAllByText(label)[0]).toBeVisible()
    })
    expect(screen.queryByText('3D')).not.toBeInTheDocument()
    expect(screen.getByText('Nanami is probably watching you.')).toBeVisible()
    expect(container.textContent).not.toMatch(
      /memorial|in memory|remembering|rest in peace/i,
    )
  })
})
