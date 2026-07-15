import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import type { ArchiveItem } from '../archive/types'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

type ArchiveViewerProps = {
  items: readonly ArchiveItem[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onClose: () => void
  returnFocusTo: HTMLElement | null
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function ArchiveViewer({
  items,
  activeIndex,
  onActiveIndexChange,
  onClose,
  returnFocusTo,
}: ArchiveViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef(returnFocusTo)
  const item = items[activeIndex]
  const hasMultipleItems = items.length > 1

  useBodyScrollLock(Boolean(item))

  useEffect(() => {
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    const previousAriaHidden = root ? root.getAttribute('aria-hidden') : null
    if (root) {
      root.inert = true
      root.setAttribute('aria-hidden', 'true')
    }
    closeRef.current?.focus()
    return () => {
      if (root) {
        root.inert = wasInert
        if (previousAriaHidden === null) root.removeAttribute('aria-hidden')
        else root.setAttribute('aria-hidden', previousAriaHidden)
      }
      const target = returnFocusRef.current
      if (target?.isConnected) target.focus()
    }
  }, [])

  useEffect(() => {
    if (!item) {
      onClose()
      return
    }

    const move = (direction: number) => {
      if (!hasMultipleItems) return
      onActiveIndexChange((activeIndex + direction + items.length) % items.length)
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
  }, [activeIndex, hasMultipleItems, item, items.length, onActiveIndexChange, onClose])

  if (!item || typeof document === 'undefined') return null

  const move = (direction: number) => {
    if (!hasMultipleItems) return
    onActiveIndexChange((activeIndex + direction + items.length) % items.length)
  }

  return createPortal(
    <div className="archive-viewer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div
        ref={dialogRef}
        className="archive-viewer__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-viewer-caption"
        tabIndex={-1}
      >
        <button
          ref={closeRef}
          className="archive-viewer__close"
          type="button"
          aria-label="Close archive viewer"
          onClick={onClose}
        >
          Close
        </button>
        <figure className="archive-viewer__figure">
          <img src={item.src} alt={item.alt} />
          <figcaption>
            <span className="museum-label text-ink">{item.type}</span>
            <h3 id="archive-viewer-caption">{item.caption}</h3>
            {item.displayDate ? <time>{item.displayDate}</time> : null}
          </figcaption>
        </figure>
        <div className="archive-viewer__controls">
          <button
            type="button"
            aria-label="Previous archive item"
            disabled={!hasMultipleItems}
            onClick={() => move(-1)}
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next archive item"
            disabled={!hasMultipleItems}
            onClick={() => move(1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
