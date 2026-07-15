import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ArchiveItem } from '../src/archive/types'
import { MoodArchive } from '../src/components/MoodArchive'

const items = [
  {
    id: 'window-watch',
    type: 'photo',
    src: '/archive/window-watch.webp',
    caption: 'Window watch.',
    alt: 'Nanami watching the street from a window',
    displayDate: 'July 2026',
    faceChecked: true,
    featured: true,
    order: 1,
  },
  {
    id: 'door-inspector',
    type: 'meme',
    src: '/archive/door-inspector.webp',
    caption: 'No closed doors.',
    alt: 'Nanami inspecting a closed door',
    faceChecked: true,
    featured: false,
    order: 2,
  },
] as const satisfies readonly ArchiveItem[]

function renderArchive() {
  return render(<MoodArchive items={items} staticExperience />)
}

describe('Mood archive viewer', () => {
  it('renders an honest curation state without inactive filters when empty', () => {
    render(<MoodArchive items={[]} staticExperience />)

    expect(screen.getByText(/being carefully curated/i)).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('filters the ribbon by archive type without invented counts', () => {
    renderArchive()

    fireEvent.click(screen.getByRole('button', { name: 'Memes' }))
    expect(
      screen.getByRole('button', { name: /view no closed doors/i }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /view window watch/i }),
    ).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\b2 photos?\b|\b1 memes?\b/i)
  })

  it('opens a thumbnail in an accessible dialog', () => {
    renderArchive()

    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Window watch.' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByAltText(items[0].alt)).toBeVisible()
    expect(screen.getByRole('button', { name: /close archive viewer/i })).toHaveFocus()
  })

  it('moves forward and backward with the arrow keys', () => {
    renderArchive()
    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(
      screen.getByRole('dialog', { name: 'No closed doors.' }),
    ).toBeVisible()

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(screen.getByRole('dialog', { name: 'Window watch.' })).toBeVisible()
  })

  it('loops keyboard navigation across the ends of the archive', () => {
    renderArchive()
    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(
      screen.getByRole('dialog', { name: 'No closed doors.' }),
    ).toBeVisible()

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByRole('dialog', { name: 'Window watch.' })).toBeVisible()
  })

  it('closes on Escape and returns focus to the exact opening thumbnail', () => {
    renderArchive()
    const opener = screen.getByRole('button', { name: /view no closed doors/i })
    opener.focus()
    fireEvent.click(opener)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('traps focus and restores the body overflow while open', () => {
    document.body.style.overflow = 'clip'
    renderArchive()
    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    const close = screen.getByRole('button', { name: /close archive viewer/i })
    const next = screen.getByRole('button', { name: /next archive item/i })
    expect(document.body.style.overflow).toBe('hidden')

    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(next).toHaveFocus()

    fireEvent.click(close)
    expect(document.body.style.overflow).toBe('clip')
  })
})
