import { useEffect } from 'react'

let lockCount = 0
let savedOverflow = ''
let savedPaddingRight = ''

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return

    const { body, documentElement } = document
    if (lockCount === 0) {
      savedOverflow = body.style.overflow
      savedPaddingRight = body.style.paddingRight
      const scrollbarWidth = documentElement.clientWidth > 0
        ? Math.max(0, window.innerWidth - documentElement.clientWidth)
        : 0
      const currentPadding = Number.parseFloat(
        window.getComputedStyle(body).paddingRight,
      ) || 0

      body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
      }
    }
    lockCount += 1

    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) {
        body.style.overflow = savedOverflow
        body.style.paddingRight = savedPaddingRight
      }
    }
  }, [locked])
}
