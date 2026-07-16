import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider, useLocale } from '../i18n/LocaleProvider'
import { nanamiProfile } from '../profile/nanami'
import { SeoMetadata } from './SeoMetadata'

function LocaleControls() {
  const { setLocale } = useLocale()
  return (
    <>
      <SeoMetadata />
      <button type="button" onClick={() => setLocale('en')}>English</button>
      <button type="button" onClick={() => setLocale('zh-CN')}>中文</button>
    </>
  )
}

function renderMetadata(strict = false) {
  const content = <LocaleProvider><LocaleControls /></LocaleProvider>
  return render(strict ? <StrictMode>{content}</StrictMode> : content)
}

function meta(selector: string) {
  return document.head.querySelector<HTMLMetaElement>(selector)
}

beforeEach(() => {
  document.head.innerHTML = ''
  localStorage.clear()
  Object.defineProperty(navigator, 'language', { configurable: true, value: 'en-US' })
})

describe('SeoMetadata', () => {
  it('publishes the English metadata and fixed canonical sharing URLs', () => {
    renderMetadata()

    expect(document.title).toBe('Nanami Cat — A Living Archive')
    expect(meta('meta[name="description"]')?.content).toBe(
      'The living digital archive of Nanami, a black cat born in Utsunomiya, Tochigi.',
    )
    expect(meta('meta[property="og:description"]')?.content).toBe(
      'The living digital archive of Nanami, a black cat born in Utsunomiya, Tochigi.',
    )
    expect(meta('meta[name="twitter:description"]')?.content).toBe(
      'The living digital archive of Nanami, a black cat born in Utsunomiya, Tochigi.',
    )
    expect(meta('meta[property="og:title"]')?.content).toBe(document.title)
    expect(meta('meta[property="og:locale"]')?.content).toBe('en_US')
    expect(document.head.querySelectorAll('meta[property="og:locale:alternate"]')).toHaveLength(1)
    expect(meta('meta[property="og:locale:alternate"]')?.content).toBe('zh_CN')
    expect(meta('meta[name="twitter:card"]')?.content).toBe('summary_large_image')
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://nanamicat.com/',
    )
    expect(meta('meta[property="og:url"]')?.content).toBe('https://nanamicat.com/')
    expect(meta('meta[property="og:image"]')?.content).toBe(
      'https://nanamicat.com/social/nanami-social-card.webp',
    )
    expect(meta('meta[name="twitter:image"]')?.content).toBe(
      'https://nanamicat.com/social/nanami-social-card.webp',
    )
  })

  it('updates localized metadata immediately and persists the selected locale', () => {
    renderMetadata()

    fireEvent.click(screen.getByRole('button', { name: '中文' }))

    expect(document.title).toBe('Nanami Cat — 生活数字档案')
    expect(meta('meta[name="description"]')?.content).toBe(
      '黑猫 Nanami 的生活数字档案。他出生于日本栃木县宇都宫市。',
    )
    expect(meta('meta[property="og:description"]')?.content).toBe(
      '黑猫 Nanami 的生活数字档案。他出生于日本栃木县宇都宫市。',
    )
    expect(meta('meta[name="twitter:description"]')?.content).toBe(
      '黑猫 Nanami 的生活数字档案。他出生于日本栃木县宇都宫市。',
    )
    expect(meta('meta[property="og:title"]')?.content).toBe(document.title)
    expect(meta('meta[property="og:locale"]')?.content).toBe('zh_CN')
    expect(document.head.querySelectorAll('meta[property="og:locale:alternate"]')).toHaveLength(1)
    expect(meta('meta[property="og:locale:alternate"]')?.content).toBe('en_US')
    expect(meta('meta[name="twitter:title"]')?.content).toBe(document.title)
    expect(localStorage.getItem('nanami-locale')).toBe('zh-CN')

    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(document.title).toBe('Nanami Cat — A Living Archive')
  })

  it('keeps one truthful Thing JSON-LD graph under StrictMode and rerenders', () => {
    const { rerender } = renderMetadata(true)
    rerender(
      <StrictMode><LocaleProvider><LocaleControls /></LocaleProvider></StrictMode>,
    )

    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(1)
    const graph = JSON.parse(scripts[0].textContent ?? '{}')['@graph']
    const website = graph.find((entry: { '@type': string }) => entry['@type'] === 'WebSite')
    const nanami = graph.find((entry: { '@id': string }) => entry['@id'] === 'https://nanamicat.com/#nanami')

    expect(website.about).toEqual({ '@id': 'https://nanamicat.com/#nanami' })
    expect(nanami).toMatchObject({
      '@type': 'Thing',
      additionalType: 'Cat',
      name: nanamiProfile.name,
      gender: nanamiProfile.sex,
      birthDate: nanamiProfile.birthDate,
      birthPlace: {
        '@type': 'Place',
        name: 'Utsunomiya, Tochigi, Japan',
      },
      disambiguatingDescription: 'A living black cat.',
    })
    expect(nanami.disambiguatingDescription).toBe('A living black cat.')
    expect(nanami).not.toHaveProperty('additionalProperty')

    const serialized = JSON.stringify(graph).toLowerCase()
    expect(serialized).not.toMatch(/person|memorial|deceased|female/)
  })
})
