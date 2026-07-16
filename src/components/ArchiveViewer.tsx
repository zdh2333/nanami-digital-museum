import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { formatArchiveDate } from '../archive/date'
import type { ArchiveItem } from '../archive/types'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useModalBackgroundLock } from '../hooks/useModalBackgroundLock'
import { useLocale } from '../i18n/LocaleProvider'

type ArchiveViewerProps = {
  items: readonly ArchiveItem[]
  activeItemId: string
  onActiveItemChange: (id: string) => void
  onClose: () => void
  returnFocusTo: HTMLElement | null
  returnFocusFallback?: () => HTMLElement | null
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let modalStack: string[] = []
const modalStackListeners = new Set<() => void>()

function emitModalStackChange() {
  modalStackListeners.forEach((listener) => listener())
}

function subscribeToModalStack(listener: () => void) {
  modalStackListeners.add(listener)
  return () => modalStackListeners.delete(listener)
}

function useIsTopmostModal(token: string, open: boolean) {
  const isTopmost = useSyncExternalStore(
    subscribeToModalStack,
    () => open && modalStack.at(-1) === token,
    () => false,
  )

  useEffect(() => {
    if (!open) return

    modalStack = [...modalStack.filter((entry) => entry !== token), token]
    emitModalStackChange()
    return () => {
      modalStack = modalStack.filter((entry) => entry !== token)
      emitModalStackChange()
    }
  }, [open, token])

  return isTopmost
}

export function ArchiveViewer({
  items,
  activeItemId,
  onActiveItemChange,
  onClose,
  returnFocusTo,
  returnFocusFallback,
}: ArchiveViewerProps) {
  const { locale, copy } = useLocale()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef(returnFocusTo)
  const [imageFailed, setImageFailed] = useState(false)
  const reactId = useId()
  const modalToken = `archive-viewer-${reactId}`
  const captionId = `archive-viewer-caption-${reactId.replace(/:/g, '')}`
  const activeIndex = items.findIndex((candidate) => candidate.id === activeItemId)
  const item = items[activeIndex]
  const hasMultipleItems = items.length > 1
  const isOpen = Boolean(item)
  const isTopmost = useIsTopmostModal(modalToken, isOpen)

  useBodyScrollLock(isOpen)
  useModalBackgroundLock(isOpen)

  useEffect(() => {
    if (!isOpen) return
    return () => {
      const opener = returnFocusRef.current
      const target = opener?.isConnected ? opener : returnFocusFallback?.()
      if (target?.isConnected) target.focus()
    }
  }, [isOpen, returnFocusFallback])

  useEffect(() => {
    if (!isOpen || !isTopmost) return

    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus())
    return () => window.cancelAnimationFrame(focusFrame)
  }, [isOpen, isTopmost])

  useEffect(() => {
    if (overlayRef.current) overlayRef.current.inert = !isTopmost
  }, [isTopmost])

  useEffect(() => setImageFailed(false), [item?.src1600])

  useEffect(() => {
    if (!item) {
      onClose()
      return
    }
    if (!isTopmost) return

    const move = (direction: number) => {
      if (!hasMultipleItems) return
      const nextIndex = (activeIndex + direction + items.length) % items.length
      onActiveItemChange(items[nextIndex].id)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
      } else if (event.key === 'Tab') {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
        )
        if (focusable.length === 0) {
          event.preventDefault()
          dialogRef.current?.focus()
          return
        }
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
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, hasMultipleItems, isTopmost, item, items, onActiveItemChange, onClose])

  if (!item || typeof document === 'undefined') return null

  const move = (direction: number) => {
    if (!hasMultipleItems) return
    const nextIndex = (activeIndex + direction + items.length) % items.length
    onActiveItemChange(items[nextIndex].id)
  }

  return createPortal(
    <div
      ref={overlayRef}
      className={`archive-viewer${isTopmost ? '' : ' archive-viewer--inactive'}`}
      role="presentation"
      aria-hidden={isTopmost ? undefined : true}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="archive-viewer__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={captionId}
        tabIndex={-1}
      >
        <button
          ref={closeRef}
          className="archive-viewer__close"
          type="button"
          aria-label={copy.archive.close}
          onClick={onClose}
        >
          {copy.archive.close}
        </button>
        <figure className="archive-viewer__figure">
          <div className="archive-viewer__media">
            {imageFailed ? (
              <div
                className="archive-image-placeholder"
                role="status"
                aria-label={copy.archive.imageUnavailable}
              >
                <span>{copy.archive.imageUnavailable}</span>
                <small>{copy.archive.imageUnavailableNote}</small>
              </div>
            ) : (
              <img
                src={item.src1600}
                alt={item.alt[locale]}
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
          <figcaption>
            <span className="museum-label text-ink">{copy.archive[item.type]}</span>
            <h3 id={captionId}>{item.caption[locale]}</h3>
            <dl className="archive-viewer__metadata">
              <div>
                <dt>{copy.archive.date}</dt>
                <dd>
                  {item.captureDate ? (
                    <time dateTime={item.captureDate}>{formatArchiveDate(item.captureDate, locale)}</time>
                  ) : copy.archive.missingDate}
                </dd>
              </div>
              {item.location ? (
                <div><dt>{copy.archive.location}</dt><dd>{item.location[locale]}</dd></div>
              ) : null}
              <div><dt>{copy.archive.story}</dt><dd>{item.story[locale]}</dd></div>
            </dl>
          </figcaption>
        </figure>
        <div className="archive-viewer__controls">
          <button
            type="button"
            aria-label={copy.archive.previous}
            disabled={!hasMultipleItems}
            onClick={() => move(-1)}
          >
            {copy.archive.previous}
          </button>
          <button
            type="button"
            aria-label={copy.archive.next}
            disabled={!hasMultipleItems}
            onClick={() => move(1)}
          >
            {copy.archive.next}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
