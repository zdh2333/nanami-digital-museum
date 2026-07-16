import { StrictMode, useRef, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider } from '../i18n/LocaleProvider'
import { MobileMenu } from './MobileMenu'

function Harness({ strict = false }: { strict?: boolean }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const content = (
    <LocaleProvider>
      <button ref={triggerRef} aria-expanded={open} onClick={() => setOpen(true)}>Menu</button>
      <MobileMenu open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} />
    </LocaleProvider>
  )
  return strict ? <StrictMode>{content}</StrictMode> : content
}

function renderHarness(strict = false) {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
  return render(<Harness strict={strict} />, { container: root })
}

describe('MobileMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    document.getElementById('root')?.remove()
  })

  it('opens a localized full navigation dialog and focuses Close', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))

    const dialog = screen.getByRole('dialog', { name: 'Museum navigation' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '#hero')
    expect(within(dialog).getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '#presence')
    expect(within(dialog).getByRole('link', { name: 'Field Notes' })).toHaveAttribute('href', '#field-notes')
    expect(within(dialog).getByRole('link', { name: 'Archive' })).toHaveAttribute('href', '#mood-archive')
    expect(within(dialog).getByRole('link', { name: 'Timeline' })).toHaveAttribute('href', '#living-archive')
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('traps focus in both directions', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const dialog = screen.getByRole('dialog')
    const close = within(dialog).getByRole('button', { name: 'Close' })
    const english = within(dialog).getByRole('button', { name: 'English' })

    english.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(close).toHaveFocus()
    close.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(english).toHaveFocus()
  })

  it.each(['Escape', 'Close', 'Home'])('closes via %s and restores scroll, root, and trigger focus', (method) => {
    renderHarness()
    const trigger = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(trigger)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.getElementById('root')).toHaveAttribute('aria-hidden', 'true')
    expect(document.getElementById('root')?.inert).toBe(true)

    if (method === 'Escape') fireEvent.keyDown(document, { key: 'Escape' })
    else fireEvent.click(screen.getByRole(method === 'Close' ? 'button' : 'link', { name: method }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
    expect(document.getElementById('root')).not.toHaveAttribute('aria-hidden')
    expect(document.getElementById('root')?.inert).toBe(false)
    expect(trigger).toHaveFocus()
  })

  it('switches language while remaining open', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    const chinese = screen.getByRole('button', { name: '中文' })
    chinese.focus()
    fireEvent.click(chinese)

    expect(screen.getByRole('dialog', { name: '博物馆导航' })).toBeVisible()
    expect(screen.getByRole('button', { name: '关闭' })).toBeVisible()
    expect(screen.getByRole('link', { name: '首页' })).toBeVisible()
    expect(screen.getByRole('group', { name: '语言' })).toBeVisible()
    expect(chinese).toHaveFocus()
    expect(localStorage.getItem('nanami-locale')).toBe('zh-CN')
  })

  it('does not leak body or background locks in StrictMode', () => {
    const { unmount } = renderHarness(true)
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    unmount()

    expect(document.body.style.overflow).toBe('')
    expect(document.getElementById('root')).not.toHaveAttribute('aria-hidden')
    expect(document.getElementById('root')?.inert).toBe(false)
  })
})
