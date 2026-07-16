import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { LocaleProvider } from './i18n/LocaleProvider'

vi.mock('./components/Hero3D', () => ({
  Hero3D: () => <div data-testid="legacy-3d-hero" />,
}))

function renderApp() {
  return render(<LocaleProvider><App /></LocaleProvider>)
}

describe('Nanami Cat museum shell', () => {
  it('introduces Nanami with the primary museum heading', () => {
    renderApp()

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'ONE BLACK CAT. MANY MOODS.',
      }),
    ).toBeInTheDocument()
  })

  it('uses the approved cinematic Nanami hero artwork instead of the legacy 3D hero', () => {
    const { container } = renderApp()

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
    renderApp()

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
    const { container } = renderApp()
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
    const { container } = renderApp()

    expect(screen.getByText('He runs the house.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'FIELD NOTES' })).toBeVisible()
    ;[
      'YELLOW-GREEN EYES',
      'RIGHT-ANGLE TAIL',
      'RED COLLAR',
      'ZERO CLOSED DOORS',
    ].forEach((identifier) => {
      expect(screen.getByText(identifier)).toBeVisible()
    })
    expect(screen.getByRole('heading', { name: 'Mood Archive' })).toBeVisible()
    expect(
      screen.getByText('Explore Nanami’s living archive.'),
    ).toBeVisible()
    ;['Photos', 'Memes', 'Portraits'].forEach((label) => {
      expect(screen.getAllByText(label)[0]).toBeVisible()
    })
    expect(screen.queryByText('3D')).not.toBeInTheDocument()
    expect(screen.getByText('Nanami is probably watching you.')).toBeVisible()
    expect(container.textContent).not.toMatch(
      /memorial|in memory|remembering|rest in peace/i,
    )
  })

  it('fills every field note with a reviewed Nanami photograph', () => {
    renderApp()
    const section = document.querySelector('#field-notes')
    expect(section).not.toBeNull()

    const notes = within(section as HTMLElement).getAllByRole('group')
    expect(notes).toHaveLength(4)
    notes.forEach((note) => {
      expect(within(note).getByRole('img')).toHaveAttribute(
        'src',
        expect.stringMatching(/nanami-photo-\d{3}-640\.webp/),
      )
      expect(within(note).getByText(/Observed:/)).toBeVisible()
    })
  })

  it('turns the living archive collections into clear, counted links', () => {
    renderApp()
    const section = document.querySelector('#living-archive')
    expect(section).not.toBeNull()

    ;['View 13 photos', 'View 6 memes', 'View 4 close portraits'].forEach(
      (name) => {
        expect(
          within(section as HTMLElement).getByRole('link', { name }),
        ).toHaveAttribute('href', '#mood-archive')
      },
    )
  })

  it('uses a real 2D Nanami face instead of synthetic closing eyes', () => {
    const { container } = renderApp()
    const closing = container.querySelector('#closing')
    expect(closing).not.toBeNull()

    expect(
      within(closing as HTMLElement).getByAltText(
        'Close portrait of Nanami looking directly into the camera.',
      ),
    ).toHaveAttribute(
      'src',
      '/archive/photos/nanami-photo-014-1600.webp',
    )
    expect(closing?.querySelector('.closing__gaze')).not.toBeInTheDocument()
  })
})
