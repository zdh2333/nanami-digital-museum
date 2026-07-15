import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

import type { ArchiveItem } from '../archive/types'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

type ArchiveViewerProps = {
  items: readonly ArchiveItem[]
  activeItemId: string
  onActiveItemChange: (id: string) => void
  onClose: () => void
  returnFocusTo: HTMLElement | null
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let backgroundLockCount = 0
let lockedRoot: HTMLElement | null = null
let savedRootInert = false
let savedRootAriaHidden: string | null = null

function useModalBackgroundLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return

    const root = document.getElementById('root')
    if (!root) return

    if (backgroundLockCount === 0) {
      lockedRoot = root
      savedRootInert = Boolean(root.inert)
      savedRootAriaHidden = root.getAttribute('aria-hidden')
      root.inert = true
      root.setAttribute('aria-hidden', 'true')
    }
    backgroundLockCount += 1

    return () => {
      backgroundLockCount = Math.max(0, backgroundLockCount - 1)
      if (backgroundLockCount !== 0 || !lockedRoot) return

      lockedRoot.inert = savedRootInert
      if (savedRootAriaHidden === null) lockedRoot.removeAttribute('aria-hidden')
      else lockedRoot.setAttribute('aria-hidden', savedRootAriaHidden)
      lockedRoot = null
    }
  }, [locked])
}

export function ArchiveViewer({
  items,
  activeItemId,
  onActiveItemChange,
  onClose,
  returnFocusTo,
}: ArchiveViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef(returnFocusTo)
  const reactId = useId()
  const captionId = `archive-viewer-caption-${reactId.replace(/:/g, '')}`
  const activeIndex = items.findIndex((candidate) => candidate.id === activeItemId)
  const item = items[activeIndex]
  const hasMultipleItems = items.length > 1
  const isOpen = Boolean(item)

  useBodyScrollLock(isOpen)
  useModalBackgroundLock(isOpen)

  useEffect(() => {
    if (!isOpen) return

    closeRef.current?.focus()
    return () => {
      const target = returnFocusRef.current
      if (target?.isConnected) target.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!item) {
      onClose()
      return
    }

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
  }, [activeIndex, hasMultipleItems, item, items, onActiveItemChange, onClose])

  if (!item || typeof document === 'undefined') return null

  const move = (direction: number) => {
    if (!hasMultipleItems) return
    const nextIndex = (activeIndex + direction + items.length) % items.length
    onActiveItemChange(items[nextIndex].id)
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
        aria-labelledby={captionId}
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
            <h3 id={captionId}>{item.caption}</h3>
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
