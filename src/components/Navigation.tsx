import { useCallback, useEffect, useRef, useState } from 'react'

import { useLocale } from '../i18n/LocaleProvider'
import { MobileMenu } from './MobileMenu'
import { navigationItems } from './navigationModel'

const desktopItems = navigationItems.slice(1)
const menuId = 'mobile-museum-menu'

export function Navigation() {
  const { locale, setLocale, copy } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const navigationLabel = locale === 'zh-CN' ? '博物馆导航' : 'Museum navigation'
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const getReturnFocusTarget = useCallback(() => returnFocusRef.current, [])

  useEffect(() => {
    if (!menuOpen || typeof window.matchMedia !== 'function') return

    const desktopQuery = window.matchMedia('(min-width: 768px)')
    const closeOnDesktop = () => {
      if (desktopQuery.matches) {
        returnFocusRef.current = brandRef.current
        closeMenu()
      }
    }

    closeOnDesktop()
    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', closeOnDesktop)
      return () => desktopQuery.removeEventListener('change', closeOnDesktop)
    }

    desktopQuery.addListener(closeOnDesktop)
    return () => desktopQuery.removeListener(closeOnDesktop)
  }, [closeMenu, menuOpen])

  return (
    <header className="museum-header">
      <nav aria-label={navigationLabel} className="museum-navigation">
        <a
          ref={brandRef}
          href="#hero"
          aria-label={`Nanami ${copy.nav.home}`}
          aria-current="page"
          className="museum-navigation__brand"
        >
          Nanami
        </a>

        <div className="museum-navigation__desktop">
          {desktopItems.map(({ key, href }) => (
            <a key={key} href={href}>{copy.nav[key]}</a>
          ))}
          <div
            className="museum-navigation__languages"
            role="group"
            aria-label={copy.nav.language}
          >
            <button
              type="button"
              aria-label="中文"
              aria-pressed={locale === 'zh-CN'}
              onClick={() => setLocale('zh-CN')}
            >中</button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              aria-label="English"
              aria-pressed={locale === 'en'}
              onClick={() => setLocale('en')}
            >EN</button>
          </div>
        </div>

        <button
          ref={menuTriggerRef}
          className="museum-navigation__menu-trigger"
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => {
            returnFocusRef.current = menuTriggerRef.current
            setMenuOpen(true)
          }}
        >
          {copy.nav.menu}
        </button>
      </nav>
      <MobileMenu
        id={menuId}
        open={menuOpen}
        onClose={closeMenu}
        triggerRef={menuTriggerRef}
        getReturnFocusTarget={getReturnFocusTarget}
      />
    </header>
  )
}
