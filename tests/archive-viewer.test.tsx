import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { validateArchive } from '../src/archive/validate'
import { ArchiveViewer } from '../src/components/ArchiveViewer'
import { MoodArchive } from '../src/components/MoodArchive'
import { LocaleProvider, useLocale } from '../src/i18n/LocaleProvider'

const items = validateArchive([
  {
    id: 'window-watch',
    type: 'photo',
    collections: ['photos', 'portraits'],
    src640: '/archive/photos/window-watch-640.webp',
    src1600: '/archive/photos/window-watch-1600.webp',
    caption: { en: 'Window watch.', 'zh-CN': '窗边巡视。' },
    alt: { en: 'Nanami watching the street from a window', 'zh-CN': '七海在窗边看街道。' },
    story: { en: 'A quiet watch.', 'zh-CN': '安静地巡视。' },
    captureDate: '2026-07-01',
    location: { en: 'Tokyo', 'zh-CN': '东京' },
    faceChecked: true,
    featured: true,
    order: 1,
  },
  {
    id: 'door-inspector',
    type: 'meme',
    collections: ['memes'],
    src640: '/archive/memes/door-inspector-640.webp',
    src1600: '/archive/memes/door-inspector-1600.webp',
    caption: { en: 'No closed doors.', 'zh-CN': '不许关门。' },
    alt: { en: 'Nanami inspecting a closed door', 'zh-CN': '七海正在检查一扇关上的门。' },
    story: { en: 'Every door is inspected.', 'zh-CN': '每扇门都要检查。' },
    faceChecked: true,
    featured: false,
    order: 2,
  },
])

function Providers({ children }: { children: React.ReactNode }) {
  return <LocaleProvider>{children}</LocaleProvider>
}

function renderArchive() {
  return render(<MoodArchive items={items} staticExperience />, { wrapper: Providers })
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Mood archive viewer', () => {
  it('renders an honest curation state without inactive filters when empty', () => {
    render(<MoodArchive items={[]} staticExperience />, { wrapper: Providers })

    expect(screen.getByText('Nanami has not added anything to this collection yet.')).toBeVisible()
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

  it('offers all four localized collection filters and portraits are a true subset', () => {
    renderArchive()

    expect(screen.getAllByRole('button', { pressed: false }).map((button) => button.textContent)).toEqual([
      'Photos', 'Memes', 'Portraits',
    ])
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Portraits' }))
    expect(screen.getByRole('button', { name: /view window watch/i })).toBeVisible()
    expect(screen.queryByRole('button', { name: /view no closed doors/i })).not.toBeInTheDocument()
  })

  it('exposes localized card names and complete metadata descriptions', () => {
    function LocaleControls() {
      const { setLocale } = useLocale()
      return <button onClick={() => setLocale('zh-CN')}>中文</button>
    }
    render(
      <LocaleProvider>
        <LocaleControls />
        <MoodArchive items={items} staticExperience />
      </LocaleProvider>,
    )

    const locatedCard = screen.getByRole('button', { name: /view window watch/i })
    const unlocatedCard = screen.getByRole('button', { name: /view no closed doors/i })
    expect(locatedCard).toHaveAccessibleName('View Window watch.')
    expect(locatedCard).toHaveAccessibleDescription(
      'Photo Date July 1, 2026 Location Tokyo',
    )
    expect(unlocatedCard).toHaveAccessibleName('View No closed doors.')
    expect(unlocatedCard).toHaveAccessibleDescription('Meme Date not recorded')
    expect(unlocatedCard).not.toHaveAccessibleDescription(/location|tokyo/i)

    fireEvent.click(screen.getByRole('button', { name: '中文' }))
    expect(locatedCard).toHaveAccessibleName('查看 窗边巡视。')
    expect(locatedCard).toHaveAccessibleDescription('照片 日期 2026年7月1日 地点 东京')
    expect(unlocatedCard).toHaveAccessibleName('查看 不许关门。')
    expect(unlocatedCard).toHaveAccessibleDescription('表情包 日期未记录')
    expect(unlocatedCard).not.toHaveAccessibleDescription(/地点|东京/)
  })

  it('does not push duplicate history entries for the selected filter', () => {
    const pushState = vi.spyOn(window.history, 'pushState')
    renderArchive()

    fireEvent.click(screen.getByRole('button', { name: /view window watch/i }))
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(pushState).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
    expect(pushState).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
    expect(pushState).toHaveBeenCalledTimes(1)
  })

  it('initializes from the query, pushes filter URLs, restores popstate, and closes the viewer', () => {
    window.history.replaceState(null, '', '/?ref=museum&collection=memes')
    renderArchive()
    expect(screen.getByRole('button', { name: 'Memes' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /view no closed doors/i }))
    expect(screen.getByRole('dialog')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.search).toBe('?ref=museum&collection=photos')
    expect(window.location.hash).toBe('#mood-archive')

    window.history.replaceState(null, '', '/?ref=museum&collection=portraits#mood-archive')
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))
    expect(screen.getByRole('button', { name: 'Portraits' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('restores pushed filters through native browser back and forward navigation', async () => {
    window.history.replaceState(null, '', '/?ref=native-history')
    renderArchive()

    fireEvent.click(screen.getByRole('button', { name: 'Photos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Memes' }))
    expect(window.location.search).toBe('?ref=native-history&collection=memes')

    act(() => window.history.back())
    await waitFor(() => {
      expect(window.location.search).toBe('?ref=native-history&collection=photos')
      expect(screen.getByRole('button', { name: 'Photos' })).toHaveAttribute('aria-pressed', 'true')
    })

    act(() => window.history.forward())
    await waitFor(() => {
      expect(window.location.search).toBe('?ref=native-history&collection=memes')
      expect(screen.getByRole('button', { name: 'Memes' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('falls back to all for invalid query values', () => {
    window.history.replaceState(null, '', '/?collection=portrait')
    renderArchive()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { name: /^view /i })).toHaveLength(2)
  })

  it('shows localized card and viewer metadata and updates while open', () => {
    function LocaleControls() {
      const { setLocale } = useLocale()
      return <button onClick={() => setLocale('zh-CN')}>中文</button>
    }
    render(
      <LocaleProvider>
        <LocaleControls />
        <MoodArchive items={items} staticExperience />
      </LocaleProvider>,
    )

    const locatedCard = screen.getByRole('button', { name: /view window watch/i })
    const unlocatedCard = screen.getByRole('button', { name: /view no closed doors/i })
    expect(within(locatedCard).getByText('Photo')).toBeVisible()
    expect(within(locatedCard).getByText('July 1, 2026')).toBeVisible()
    expect(within(locatedCard).getByText('Location')).toBeVisible()
    expect(within(locatedCard).getByText('Tokyo')).toBeVisible()
    expect(within(unlocatedCard).getByText('Date not recorded')).toBeVisible()
    expect(within(unlocatedCard).queryByText('Location')).not.toBeInTheDocument()
    expect(within(unlocatedCard).queryByText('Tokyo')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /view window watch/i }))
    const dialog = screen.getByRole('dialog', { name: 'Window watch.' })
    expect(within(dialog).getByText('Date')).toBeVisible()
    expect(within(dialog).getByText('Tokyo')).toBeVisible()
    expect(within(dialog).getByText('Story')).toBeVisible()
    expect(within(dialog).getByText('A quiet watch.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '中文' }))
    const localizedDialog = screen.getByRole('dialog', { name: '窗边巡视。' })
    expect(within(locatedCard).getByText('地点')).toBeVisible()
    expect(within(locatedCard).getByText('东京')).toBeVisible()
    expect(within(localizedDialog).getByAltText('七海在窗边看街道。')).toBeVisible()
    expect(within(localizedDialog).getByText('2026年7月1日')).toBeVisible()
    expect(within(localizedDialog).getByText('东京')).toBeVisible()
    expect(within(localizedDialog).getByText('故事')).toBeVisible()
    expect(within(localizedDialog).getByText('安静地巡视。')).toBeVisible()
    expect(screen.getByRole('button', { name: '关闭' })).toBeVisible()
  })

  it('opens a thumbnail in an accessible dialog', () => {
    renderArchive()

    fireEvent.click(
      screen.getByRole('button', { name: /view window watch/i }),
    )

    const dialog = screen.getByRole('dialog', { name: 'Window watch.' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByAltText(items[0].alt.en)).toBeVisible()
    expect(screen.getByRole('button', { name: /^close$/i })).toHaveFocus()
  })

  it('uses responsive 640px cards and keeps the 1600px asset for the viewer', () => {
    renderArchive()

    const cardImage = screen.getByAltText(items[0].alt.en)
    expect(cardImage).toHaveAttribute('src', '/archive/photos/window-watch-640.webp')
    expect(cardImage).toHaveAttribute(
      'srcset',
      '/archive/photos/window-watch-640.webp 640w, /archive/photos/window-watch-1600.webp 1600w',
    )
    expect(cardImage).toHaveAttribute('sizes', expect.stringContaining('320px'))

    fireEvent.click(screen.getByRole('button', { name: /view window watch/i }))
    expect(within(screen.getByRole('dialog')).getByAltText(items[0].alt.en)).toHaveAttribute(
      'src',
      '/archive/photos/window-watch-1600.webp',
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

    const close = screen.getByRole('button', { name: /^close$/i })
    const next = screen.getByRole('button', { name: /^next$/i })
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
    const { unmount } = render(<LocaleProvider><TwoViewers /></LocaleProvider>, { container: root })
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
      within(dialog).getByRole('button', { name: /^next$/i }),
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
