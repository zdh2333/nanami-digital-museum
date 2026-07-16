import { useEffect, useState } from 'react'

export function shouldUseStaticExperience(prefersReducedMotion: boolean) {
  return prefersReducedMotion
}

function readPreference() {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedExperience() {
  const [staticExperience, setStaticExperience] = useState(readPreference)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => {
      setStaticExperience(
        shouldUseStaticExperience(mediaQuery?.matches ?? readPreference()),
      )
    }

    update()
    if (typeof mediaQuery?.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
    } else {
      mediaQuery?.addListener?.(update)
    }

    return () => {
      if (typeof mediaQuery?.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', update)
      } else {
        mediaQuery?.removeListener?.(update)
      }
    }
  }, [])

  return staticExperience
}
