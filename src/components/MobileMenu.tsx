import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useModalBackgroundLock } from '../hooks/useModalBackgroundLock'
import { useLocale } from '../i18n/LocaleProvider'
import { navigationItems } from './navigationModel'

type MobileMenuProps = {
  id?: string
  open: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
  getReturnFocusTarget?: () => HTMLElement | null
}

const focusableSelector = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function MobileMenu({
  id = 'mobile-museum-menu',
  open,
  onClose,
  triggerRef,
  getReturnFocusTarget,
}: MobileMenuProps) {
  const { locale, setLocale, copy } = useLocale()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useBodyScrollLock(open)
  useModalBackgroundLock(open)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()

    return () => {
      const target = getReturnFocusTarget?.() ?? triggerRef.current
      if (target?.isConnected) target.focus()
    }
  }, [getReturnFocusTarget, open, triggerRef])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open || typeof document === 'undefined') return null

  const navigationLabel = locale === 'zh-CN' ? '博物馆导航' : 'Museum navigation'

  return createPortal(
    <div
      id={id}
      ref={dialogRef}
      className="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label={navigationLabel}
    >
      <div className="mobile-menu__topline">
        <span aria-hidden="true">NNM / NAV</span>
        <button ref={closeRef} type="button" onClick={onClose}>{copy.nav.close}</button>
      </div>
      <nav aria-label={navigationLabel}>
        {navigationItems.map(({ key, href }, index) => (
          <a key={key} href={href} onClick={onClose}>
            <span aria-hidden="true">0{index + 1}</span>
            {copy.nav[key]}
          </a>
        ))}
      </nav>
      <div
        className="mobile-menu__languages"
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
    </div>,
    document.body,
  )
}
