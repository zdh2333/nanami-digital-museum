import { useEffect } from 'react'

let lockCount = 0
let lockedRoot: HTMLElement | null = null
let savedInert = false
let savedAriaHidden: string | null = null

export function useModalBackgroundLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return

    const root = document.getElementById('root')
    if (!root) return

    if (lockCount === 0) {
      lockedRoot = root
      savedInert = Boolean(root.inert)
      savedAriaHidden = root.getAttribute('aria-hidden')
      root.inert = true
      root.setAttribute('aria-hidden', 'true')
    }
    lockCount += 1

    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount !== 0 || !lockedRoot) return

      lockedRoot.inert = savedInert
      if (savedAriaHidden === null) lockedRoot.removeAttribute('aria-hidden')
      else lockedRoot.setAttribute('aria-hidden', savedAriaHidden)
      lockedRoot = null
    }
  }, [locked])
}
