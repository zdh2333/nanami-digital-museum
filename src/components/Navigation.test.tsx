import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleProvider } from '../i18n/LocaleProvider'
import { Navigation } from './Navigation'

function renderNavigation() {
  return render(
    <LocaleProvider>
      <Navigation />
    </LocaleProvider>,
  )
}

function installMatchMedia(initialMatches = false) {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mediaQuery = {
    get matches() { return matches },
    media: '(min-width: 768px)',
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery))

  return {
    mediaQuery,
    setMatches(nextMatches: boolean) {
      matches = nextMatches
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent
      listeners.forEach((listener) => listener(event))
    },
  }
}

describe('Navigation', () => {
  beforeEach(() => {
    localStorage.clear()
    installMatchMedia()
  })

  it('renders the bilingual desktop museum links without duplicate archive links', () => {
    renderNavigation()

    const nav = screen.getByRole('navigation', { name: 'Museum navigation' })
    expect(within(nav).getByRole('link', { name: 'Nanami Home' })).toHaveAttribute('href', '#hero')
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '#presence')
    expect(within(nav).getByRole('link', { name: 'Field Notes' })).toHaveAttribute('href', '#field-notes')
    expect(within(nav).getByRole('link', { name: 'Archive' })).toHaveAttribute('href', '#mood-archive')
    expect(within(nav).getByRole('link', { name: 'Timeline' })).toHaveAttribute('href', '#living-archive')
    expect(within(nav).queryByRole('link', { name: /photos|memes|explore/i })).not.toBeInTheDocument()

    expect(within(nav).getByRole('button', { name: '中文' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(nav).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches desktop navigation immediately and persists the locale', () => {
    renderNavigation()
    const nav = screen.getByRole('navigation', { name: 'Museum navigation' })

    fireEvent.click(within(nav).getByRole('button', { name: '中文' }))

    expect(screen.getByRole('navigation', { name: '博物馆导航' })).toBeVisible()
    expect(screen.getByRole('link', { name: '资料' })).toHaveAttribute('href', '#presence')
    expect(screen.getByRole('link', { name: '观察笔记' })).toHaveAttribute('href', '#field-notes')
    expect(screen.getByRole('link', { name: '档案' })).toHaveAttribute('href', '#mood-archive')
    expect(screen.getByRole('link', { name: '时间线' })).toHaveAttribute('href', '#living-archive')
    expect(localStorage.getItem('nanami-locale')).toBe('zh-CN')
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
    expect(screen.getByRole('button', { name: '中文' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('exposes an accessible mobile menu trigger', () => {
    renderNavigation()
    const trigger = screen.getByRole('button', { name: 'Menu' })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Museum navigation' })).toBeVisible()
  })

  it('closes an open mobile menu and releases locks when the viewport becomes desktop', () => {
    const media = installMatchMedia()
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)
    render(
      <LocaleProvider><Navigation /></LocaleProvider>,
      { container: root },
    )
    const trigger = screen.getByRole('button', { name: 'Menu' })

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(document.body.style.overflow).toBe('hidden')
    expect(root).toHaveAttribute('aria-hidden', 'true')

    act(() => media.setMatches(true))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.body.style.overflow).toBe('')
    expect(root).not.toHaveAttribute('aria-hidden')
    expect(root.inert).toBe(false)
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(document.body.style.overflow).toBe('')
  })
})
