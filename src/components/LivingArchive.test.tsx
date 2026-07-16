import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { collectionCounts, filterArchive, representativeItem } from '../archive/collections'
import { archiveItems } from '../archive/items'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { LivingArchive } from './LivingArchive'
import { MoodArchive } from './MoodArchive'

function renderArchive(locale: 'en' | 'zh-CN' = 'en') {
  localStorage.setItem('nanami-locale', locale)
  return render(
    <LocaleProvider>
      <MoodArchive staticExperience />
      <LivingArchive staticExperience now={new Date('2026-07-16T12:00:00+09:00')} />
    </LocaleProvider>,
  )
}

describe('LivingArchive', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => vi.restoreAllMocks())

  it('derives the directory counts, portrait subset, previews, and hrefs from archive data', () => {
    renderArchive()
    const section = document.querySelector('#living-archive') as HTMLElement
    const counts = collectionCounts(archiveItems)

    for (const collection of ['photos', 'memes', 'portraits'] as const) {
      const label = `${collection[0].toUpperCase()}${collection.slice(1)}`
      const link = within(section).getByRole('link', {
        name: `View ${counts[collection]} ${collection}`,
      })
      expect(link).toHaveAttribute('href', `?collection=${collection}#mood-archive`)
      expect(within(link).getByText(String(counts[collection]))).toBeVisible()
      expect(within(link).getByRole('img')).toHaveAttribute(
        'src',
        representativeItem(archiveItems, collection)?.src640,
      )
    }

    expect(filterArchive(archiveItems, 'portraits')).toHaveLength(counts.portraits)
  })

  it('activates an unmodified collection link without reloading and focuses Mood Archive', async () => {
    renderArchive()
    const pushState = vi.spyOn(window.history, 'pushState')

    fireEvent.click(screen.getByRole('link', { name: /View \d+ portraits/ }))

    expect(pushState).toHaveBeenCalledOnce()
    expect(window.location.search).toBe('?collection=portraits')
    await waitFor(() => expect(document.querySelector('#mood-archive')).toHaveFocus())
    expect(document.querySelectorAll('#mood-archive .archive-card')).toHaveLength(
      collectionCounts(archiveItems).portraits,
    )
  })

  it('keeps modified clicks native', () => {
    renderArchive()
    const pushState = vi.spyOn(window.history, 'pushState')
    const link = screen.getByRole('link', { name: /View \d+ photos/ })
    link.addEventListener('click', (event) => event.preventDefault())

    fireEvent.click(link, { ctrlKey: true })

    expect(pushState).not.toHaveBeenCalled()
  })

  it('renders canonical English and Chinese timeline facts and the latest capture', () => {
    const { unmount } = renderArchive()
    const timeline = document.querySelector('dl[aria-label="Nanami timeline"]') as HTMLElement
    expect(timeline).not.toHaveAttribute('role')
    expect(timeline.querySelectorAll('dt')).toHaveLength(3)
    expect(timeline.querySelectorAll('dd')).toHaveLength(3)
    expect(timeline).toHaveTextContent('BornApril 1, 2021 · Utsunomiya, Tochigi, Japan')
    expect(timeline).toHaveTextContent('Current age2026 · 5 years old')
    expect(timeline).toHaveTextContent('Latest captureJune 22, 2026')

    unmount()
    renderArchive('zh-CN')
    const chineseTimeline = document.querySelector('dl[aria-label="Nanami 时间线"]') as HTMLElement
    expect(chineseTimeline).not.toHaveAttribute('role')
    expect(chineseTimeline).toHaveTextContent('出生日期2021年4月1日 · 日本栃木县宇都宫市')
    expect(chineseTimeline).toHaveTextContent('当前年龄2026年 · 5岁')
    expect(chineseTimeline).toHaveTextContent('最近拍摄2026年6月22日')
  })

  it('uses natural count-aware Chinese collection labels', () => {
    renderArchive('zh-CN')
    const counts = collectionCounts(archiveItems)

    expect(screen.getByRole('link', { name: `查看照片，共 ${counts.photos} 项` })).toBeVisible()
    expect(screen.getByRole('link', { name: `查看表情包，共 ${counts.memes} 项` })).toBeVisible()
    expect(screen.getByRole('link', { name: `查看肖像，共 ${counts.portraits} 项` })).toBeVisible()
  })

  it('omits latest capture when a fixture has no capture dates', () => {
    localStorage.setItem('nanami-locale', 'en')
    render(
      <LocaleProvider>
        <LivingArchive staticExperience items={archiveItems.map(({ captureDate: _date, ...item }) => item)} />
      </LocaleProvider>,
    )

    expect(screen.queryByText('Latest capture')).not.toBeInTheDocument()
  })
})
