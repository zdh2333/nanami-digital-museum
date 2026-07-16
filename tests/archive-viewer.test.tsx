import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ArchiveItem } from '../src/archive/types'
import { ArchiveViewer } from '../src/components/ArchiveViewer'
import { MoodArchive } from '../src/components/MoodArchive'

const items = [
  {
    id: 'window-watch',
    type: 'photo',
    collections: ['photos', 'portraits'],
    src640: '/archive/window-watch-640.webp',
    src1600: '/archive/window-watch-1600.webp',
    caption: { en: 'Window watch.', 'zh-CN': '窗边巡视。' },
    alt: { en: 'Nanami watching the street from a window', 'zh-CN': '七海在窗边看街道。' },
    story: { en: 'A quiet watch.', 'zh-CN': '安静地巡视。' },
    captureDate: '2026-07-01',
    faceChecked: true,
    featured: true,
    order: 1,
  },
  {
    id: 'door-inspector',
    type: 'meme',
    collections: ['memes'],
    src640: '/archive/door-inspector-640.webp',
    src1600: '/archive/door-inspector-1600.webp',
    caption: { en: 'No closed doors.', 'zh-CN': '不许关门。' },
    alt: { en: 'Nanami inspecting a closed door', 'zh-CN': '七海正在检查一扇关上的门。' },
    story: { en: 'Every door is inspected.', 'zh-CN': '每扇门都要检查。' },
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
    expect(within(dialog).getByAltText(items[0].alt.en)).toBeVisible()
    expect(screen.getByRole('button', { name: /close archive viewer/i })).toHaveFocus()
  })

  it('uses responsive 640px cards and keeps the 1600px asset for the viewer', () => {
    renderArchive()

    const cardImage = screen.getByAltText(items[0].alt.en)
    expect(cardImage).toHaveAttribute('src', '/archive/window-watch-640.webp')
    expect(cardImage).toHaveAttribute(
      'srcset',
      '/archive/window-watch-640.webp 640w, /archive/window-watch-1600.webp 1600w',
    )
    expect(cardImage).toHaveAttribute('sizes', expect.stringContaining('320px'))

    fireEvent.click(screen.getByRole('button', { name: /view window watch/i }))
    expect(within(screen.getByRole('dialog')).getByAltText(items[0].alt.en)).toHaveAttribute(
      'src',
      '/archive/window-watch-1600.webp',
    )
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

  it('keeps the same active item when the archive order changes', () => {
    const { rerender } = renderArchive()
    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    rerender(
      <MoodArchive items={[items[1], items[0]]} staticExperience />,
    )

    expect(screen.getByRole('dialog', { name: 'Window watch.' })).toBeVisible()
  })

  it('closes safely when the active item is removed', () => {
    const { rerender } = renderArchive()
    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    rerender(<MoodArchive items={[items[1]]} staticExperience />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(
      screen.getByRole('button', { name: /view no closed doors/i }),
    ).toHaveFocus()
  })

  it('gives keyboard ownership to only the topmost concurrent viewer', () => {
    function TwoViewers() {
      const [firstOpen, setFirstOpen] = useState(true)
      const [secondOpen, setSecondOpen] = useState(true)
      const [firstId, setFirstId] = useState(items[0].id)
      const [secondId, setSecondId] = useState(items[0].id)

      return (
        <>
          {firstOpen ? (
            <ArchiveViewer
              items={items}
              activeItemId={firstId}
              onActiveItemChange={setFirstId}
              onClose={() => setFirstOpen(false)}
              returnFocusTo={null}
            />
          ) : null}
          {secondOpen ? (
            <ArchiveViewer
              items={items}
              activeItemId={secondId}
              onActiveItemChange={setSecondId}
              onClose={() => setSecondOpen(false)}
              returnFocusTo={null}
            />
          ) : null}
        </>
      )
    }

    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)
    const { unmount } = render(<TwoViewers />, { container: root })
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    const labelIds = Array.from(dialogs, (dialog) =>
      dialog.getAttribute('aria-labelledby'),
    )

    expect(new Set(labelIds).size).toBe(2)
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    const openDialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    const lowerOverlay = openDialogs[0].closest<HTMLElement>('.archive-viewer')!
    const topOverlay = openDialogs[1].closest<HTMLElement>('.archive-viewer')!
    expect(openDialogs[0]).toHaveAccessibleName('Window watch.')
    expect(openDialogs[1]).toHaveAccessibleName('No closed doors.')
    expect(lowerOverlay).toHaveAttribute('aria-hidden', 'true')
    expect(lowerOverlay.inert).toBe(true)
    expect(topOverlay).not.toHaveAttribute('aria-hidden')
    expect(topOverlay.inert).toBe(false)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Window watch.')

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByRole('dialog')).toHaveAccessibleName('No closed doors.')
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(root).not.toHaveAttribute('aria-hidden')
    expect(root.inert).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    unmount()
    root.remove()
  })

  it('replaces failed thumbnail and viewer images with accessible placeholders', () => {
    renderArchive()
    const thumbnail = screen.getByAltText(items[0].alt.en)

    fireEvent.error(thumbnail)
    expect(screen.getByRole('status', { name: /image unavailable/i })).toBeVisible()
    expect(screen.getByText(items[0].caption.en)).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )
    const dialog = screen.getByRole('dialog', { name: items[0].caption.en })
    fireEvent.error(within(dialog).getByAltText(items[0].alt.en))

    expect(
      within(dialog).getByRole('status', { name: /image unavailable/i }),
    ).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: /next archive item/i }),
    ).toBeEnabled()
    expect(dialog.textContent).not.toContain(items[0].id)
    expect(dialog.textContent).not.toContain(items[0].src1600)
  })

  it('allows both horizontal ribbon swipes and vertical page gestures', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/styles.css'),
      'utf8',
    )

    expect(css).toMatch(
      /\.mood-archive__ribbon\s*\{[^}]*touch-action:\s*(?:auto|pan-x pan-y)/s,
    )
  })
})
