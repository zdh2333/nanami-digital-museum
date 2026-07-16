import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { copy, type MuseumCopy } from './copy'
import type { Locale } from './types'

const localeStorageKey = 'nanami-locale'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  copy: MuseumCopy
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'zh-CN'
}

export function detectLocale(): Locale {
  try {
    const savedLocale = localStorage.getItem(localeStorageKey)
    if (isLocale(savedLocale)) {
      return savedLocale
    }
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)

    try {
      localStorage.setItem(localeStorageKey, nextLocale)
    } catch {
      // The in-memory locale remains usable when persistence is unavailable.
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(
    () => ({ locale, setLocale, copy: copy[locale] }),
    [locale, setLocale],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext)

  if (!value) {
    throw new Error('useLocale must be used inside LocaleProvider')
  }

  return value
}
