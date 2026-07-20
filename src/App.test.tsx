import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App'
import { LocaleProvider } from './i18n/LocaleProvider'

function renderApp(locale: 'en' | 'zh-CN' = 'en') {
  localStorage.setItem('nanami-locale', locale)
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

  it('localizes the hero title and cinematic disclosure without changing the approved image', () => {
    const { unmount } = renderApp()
    expect(screen.getByText('Cinematic portrait')).toBeVisible()
    expect(screen.getByAltText('Nanami, a black cat, sitting in a dark room and looking directly at the camera.')).toHaveAttribute(
      'src', '/hero/nanami-cinematic-hero.webp',
    )

    unmount()
    renderApp('zh-CN')
    expect(screen.getByRole('heading', { level: 1, name: '一只黑猫。 无数种表情。' })).toBeVisible()
    expect(screen.getByText('艺术化肖像')).toBeVisible()
    expect(screen.getByAltText('黑猫七海坐在昏暗的房间里，直接看向镜头。')).toHaveAttribute(
      'src', '/hero/nanami-cinematic-hero.webp',
    )
  })

  it('uses the approved cinematic Nanami hero artwork instead of the legacy 3D hero', () => {
    const { container } = renderApp()

    const portrait = screen.getByAltText(
      'Nanami, a black cat, sitting in a dark room and looking directly at the camera.',
    )
    expect(portrait).toBeVisible()
    expect(portrait).toHaveAttribute('src', '/hero/nanami-cinematic-hero.webp')
    expect(portrait).toHaveAttribute('fetchpriority', 'high')
    expect(portrait).toHaveAttribute('decoding', 'sync')
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('places a real-photo archive ribbon between the hero and the museum chapters', () => {
    const { container } = renderApp()
    const ribbon = container.querySelector('.archive-ribbon')
    const hero = container.querySelector('#hero')
    const presence = container.querySelector('#presence')

    expect(ribbon).toHaveAttribute('aria-label', 'Collection')
    expect(hero?.nextElementSibling).toBe(ribbon)
    expect(ribbon?.nextElementSibling).toBe(presence)
    expect(within(ribbon as HTMLElement).getAllByRole('img').length).toBeGreaterThan(4)
  })

  it('keeps the archive transition as two opposing real-photo rails', () => {
    const { container } = renderApp()
    const ribbon = container.querySelector('.archive-ribbon') as HTMLElement

    expect(ribbon.querySelectorAll('.archive-ribbon__row')).toHaveLength(2)
    expect(ribbon.querySelector('.archive-ribbon__row--forward')).not.toBeNull()
    expect(ribbon.querySelector('.archive-ribbon__row--reverse')).not.toBeNull()
    expect(within(ribbon).getAllByRole('img')).toHaveLength(14)
    expect(within(ribbon).getByText('Photos')).toBeVisible()
    expect(within(ribbon).getByText('Memes')).toBeVisible()
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

  it('presents the seven museum sections in the approved narrative order', () => {
    const { container } = renderApp()
    const sections = Array.from(container.querySelectorAll('main > section'))

    expect(sections.map((section) => section.id)).toEqual([
      'hero',
      'presence',
      'field-notes',
      'mood-archive',
      'living-archive',
      'guestbook',
      'closing',
    ])
    sections.forEach((section) => {
      expect(section.querySelectorAll('h1, h2')).toHaveLength(1)
      expect(section).toHaveClass('anchor-target')
    })
  })

  it('uses the approved living archive copy without mourning language', () => {
    const { container } = renderApp()

    expect(screen.getByText('He runs the house.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Ways to recognize Nanami.' })).toBeVisible()
    ;[
      'Yellow-green eyes',
      'Right-angle tail tip',
      'Red collar',
      'Zero closed doors',
    ].forEach((identifier) => {
      expect(screen.getByText(identifier)).toBeVisible()
    })
    expect(screen.getByRole('heading', { name: 'Mood Archive' })).toBeVisible()
    expect(
      screen.getByText('His story is still unfolding.'),
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

  it('uses reviewed evidence for all four field notes', () => {
    renderApp()
    const section = document.querySelector('#field-notes')
    expect(section).not.toBeNull()

    const notes = within(section as HTMLElement).getAllByRole('group')
    expect(notes).toHaveLength(4)
    expect(notes.filter((note) => within(note).queryByRole('img'))).toHaveLength(4)
    expect(within(notes[1]).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-020-640.webp')
    expect(within(notes[1]).getByText('Observed', { exact: true })).toBeVisible()
  })

  it('turns the living archive collections into clear, counted links', () => {
    renderApp()
    const section = document.querySelector('#living-archive')
    expect(section).not.toBeNull()

    ;['photos', 'memes', 'portraits'].forEach((collection) => {
      const link = within(section as HTMLElement).getByRole('link', {
        name: new RegExp(`View \\d+ ${collection}`),
      })
      expect(link).toHaveAttribute('href', `?collection=${collection}#mood-archive`)
    })
  })

  it('localizes the closing chapter and always returns to his territory', () => {
    const { unmount } = renderApp()
    expect(screen.getByRole('link', { name: 'Return to his territory' })).toHaveAttribute('href', '#hero')

    unmount()
    renderApp('zh-CN')
    expect(screen.getByRole('heading', { name: 'Nanami 可能正在看着你。' })).toBeVisible()
    expect(screen.getByRole('link', { name: '回到他的领地' })).toHaveAttribute('href', '#hero')
  })

  it('keeps public contact details at the bottom of the museum', () => {
    renderApp()

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'Email zhoudonghao2333@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:zhoudonghao2333@gmail.com',
    )
    expect(within(footer).getByRole('link', { name: 'QQ 769072617' })).toHaveAttribute(
      'href',
      expect.stringContaining('uin=769072617'),
    )
  })

  it('uses a real 2D Nanami face instead of synthetic closing eyes', () => {
    const { container } = renderApp()
    const closing = container.querySelector('#closing')
    expect(closing).not.toBeNull()

    expect(
      within(closing as HTMLElement).getByAltText(
        'Nanami standing on a bed and looking straight ahead.',
      ),
    ).toHaveAttribute(
      'src',
      '/archive/photos/nanami-photo-014-1600.webp',
    )
    expect(closing?.querySelector('.closing__gaze')).not.toBeInTheDocument()
  })
})
