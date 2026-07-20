import { render, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider } from '../i18n/LocaleProvider'
import { FieldNotes } from './FieldNotes'

function renderNotes(locale: 'en' | 'zh-CN') {
  localStorage.setItem('nanami-locale', locale)
  const { container } = render(
    <LocaleProvider><FieldNotes staticExperience /></LocaleProvider>,
  )
  return container.querySelector('#field-notes') as HTMLElement
}

describe('FieldNotes', () => {
  beforeEach(() => localStorage.clear())

  it('renders the four English observations from localized copy and reviewed evidence', () => {
    const section = renderNotes('en')
    const notes = within(section).getAllByRole('group')

    expect(within(section).getByRole('heading', { name: 'Ways to recognize Nanami.' })).toBeVisible()
    expect(notes).toHaveLength(4)
    expect(within(notes[0]).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-003-640.webp')
    expect(within(notes[1]).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-020-640.webp')
    expect(within(notes[2]).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-002-640.webp')
    expect(within(notes[3]).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-007-640.webp')
    expect(within(notes[0]).getByText('Yellow-green eyes')).toBeVisible()
    expect(within(notes[3]).getByText('Zero closed doors')).toBeVisible()
  })

  it('uses a reviewed photograph to document the tail observation', () => {
    const section = renderNotes('en')
    const tail = within(section).getByRole('group', { name: 'Right-angle tail tip' })

    expect(tail).not.toHaveClass('field-note--text-only')
    expect(within(tail).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-020-640.webp')
    expect(within(tail).getByText('Observed', { exact: true })).toBeVisible()
  })

  it('renders the complete Simplified Chinese chapter including the observed tail evidence', () => {
    const section = renderNotes('zh-CN')
    const tail = within(section).getByRole('group', { name: '直角尾巴尖' })

    expect(within(section).getByRole('heading', { name: '如何认出 Nanami。' })).toBeVisible()
    expect(within(section).getByText('黄绿色眼睛')).toBeVisible()
    expect(within(section).getByText('红色项圈')).toBeVisible()
    expect(within(section).getByText('不许关门')).toBeVisible()
    expect(within(tail).getByRole('img')).toHaveAttribute('src', '/archive/photos/nanami-photo-020-640.webp')
    expect(within(tail).getByText('观察记录', { exact: true })).toBeVisible()
  })
})
