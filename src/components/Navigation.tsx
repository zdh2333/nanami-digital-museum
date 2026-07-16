import { useRef, useState } from 'react'

import { useLocale } from '../i18n/LocaleProvider'
import { MobileMenu } from './MobileMenu'
import { navigationItems } from './navigationModel'

const desktopItems = navigationItems.slice(1)
const menuId = 'mobile-museum-menu'

export function Navigation() {
  const { locale, setLocale, copy } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const navigationLabel = locale === 'zh-CN' ? '博物馆导航' : 'Museum navigation'

  return (
    <header className="museum-header">
      <nav aria-label={navigationLabel} className="museum-navigation">
        <a
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
            aria-label={locale === 'zh-CN' ? '语言' : 'Language'}
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
          onClick={() => setMenuOpen(true)}
        >
          {copy.nav.menu}
        </button>
      </nav>
      <MobileMenu
        id={menuId}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={menuTriggerRef}
      />
    </header>
  )
}
