import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '../App'
import { LocaleProvider } from '../i18n/LocaleProvider'

function renderProfile(locale: 'en' | 'zh-CN' = 'en') {
  localStorage.setItem('nanami-locale', locale)
  render(<LocaleProvider><App /></LocaleProvider>)

  const section = document.querySelector('#presence')
  expect(section).not.toBeNull()
  return section as HTMLElement
}

function expectFact(section: HTMLElement, label: string, value: string) {
  const term = within(section).getByText(label, { selector: 'dt' })
  const description = term.nextElementSibling

  expect(description).toHaveTextContent(value)
  expect(description?.tagName).toBe('DD')
}

describe('Nanami profile chapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T12:00:00+09:00'))
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('renders the truthful English facts as a semantic definition list', () => {
    const section = renderProfile()

    expect(within(section).getByRole('heading', { name: 'He runs the house.' })).toBeVisible()
    expect(section.querySelector('dl')).not.toBeNull()
    expectFact(section, 'Age', '5 years old')
    expectFact(section, 'Born', 'April 1, 2021')
    expectFact(section, 'Birthplace', 'Utsunomiya, Tochigi, Japan')
    expectFact(section, 'Sex', 'Male')
  })

  it('renders the exact saved Simplified Chinese facts', () => {
    const section = renderProfile('zh-CN')

    expect(within(section).getByRole('heading', { name: '这个家归他管。' })).toBeVisible()
    expectFact(section, '年龄', '5岁')
    expectFact(section, '出生日期', '2021年4月1日')
    expectFact(section, '出生地', '日本栃木县宇都宫市')
    expectFact(section, '性别', '男')
  })

  it('keeps the reviewed responsive room photograph and section identity', () => {
    const section = renderProfile()
    const portrait = within(section).getByAltText(
      'Nanami standing at the edge of a bed and looking directly at the camera.',
    )

    expect(section).toHaveAttribute('data-museum-section', 'presence')
    expect(section).toHaveClass('anchor-target', 'museum-section', 'presence')
    expect(portrait).toHaveAttribute('src', '/archive/photos/nanami-photo-002-640.webp')
    expect(portrait).toHaveAttribute('srcset', expect.stringContaining('nanami-photo-002-1600.webp'))
    expect(portrait).toHaveAttribute('loading', 'lazy')
  })
})
