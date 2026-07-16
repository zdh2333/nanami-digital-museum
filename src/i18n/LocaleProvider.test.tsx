import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LocaleProvider, useLocale } from './LocaleProvider'

function Probe() {
  const { copy, locale, setLocale } = useLocale()

  return (
    <>
      <span data-testid="locale">{locale}</span>
      <span>{copy.nav.archive}</span>
      <button type="button" onClick={() => setLocale('zh-CN')}>
        中文
      </button>
      <button type="button" onClick={() => setLocale('en')}>
        English
      </button>
    </>
  )
}

const originalLanguageDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'language',
)
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'localStorage',
)
let savedStorageEntries: [string, string][] = []

function setBrowserLanguage(language: string) {
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: language,
  })
}

describe('LocaleProvider', () => {
  beforeEach(() => {
    savedStorageEntries = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index),
    )
      .filter((key): key is string => key !== null)
      .map((key) => [key, localStorage.getItem(key) ?? ''])
    localStorage.clear()
    document.documentElement.removeAttribute('lang')
  })

  afterEach(() => {
    cleanup()

    if (originalLanguageDescriptor) {
      Object.defineProperty(navigator, 'language', originalLanguageDescriptor)
    } else {
      delete (navigator as { language?: string }).language
    }

    if (originalStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', originalStorageDescriptor)
    } else {
      delete (window as { localStorage?: Storage }).localStorage
    }

    localStorage.clear()
    savedStorageEntries.forEach(([key, value]) => localStorage.setItem(key, value))
  })

  it('uses Chinese when the browser language starts with zh regardless of case', () => {
    setBrowserLanguage('ZH-tW')

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN')
    expect(screen.getByText('档案')).toBeVisible()
  })

  it('falls back to English for a non-Chinese browser', () => {
    setBrowserLanguage('ja-JP')

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    expect(screen.getByText('Archive')).toBeVisible()
  })

  it('lets a valid saved preference override the browser language', () => {
    setBrowserLanguage('zh-CN')
    localStorage.setItem('nanami-locale', 'en')

    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('locale')).toHaveTextContent('en')
  })

  it('persists locale changes', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '中文' }))

    expect(localStorage.getItem('nanami-locale')).toBe('zh-CN')
  })

  it('updates the document language when the locale changes', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )

    expect(document.documentElement.lang).toBe('en')
    fireEvent.click(screen.getByRole('button', { name: '中文' }))
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('keeps locale state usable when storage reads and writes throw', () => {
    setBrowserLanguage('en-US')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage unavailable')
      },
    })

    expect(() =>
      render(
        <LocaleProvider>
          <Probe />
        </LocaleProvider>,
      ),
    ).not.toThrow()
    expect(screen.getByTestId('locale')).toHaveTextContent('en')

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: '中文' })),
    ).not.toThrow()
    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })

  it('throws a clear error when useLocale is called outside the provider', () => {
    expect(() => renderToString(<Probe />)).toThrow(
      'useLocale must be used inside LocaleProvider',
    )
  })
})
