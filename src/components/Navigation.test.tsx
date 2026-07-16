import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider } from '../i18n/LocaleProvider'
import { Navigation } from './Navigation'

function renderNavigation() {
  return render(
    <LocaleProvider>
      <Navigation />
    </LocaleProvider>,
  )
}

describe('Navigation', () => {
  beforeEach(() => localStorage.clear())

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
})
