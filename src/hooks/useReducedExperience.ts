import { useEffect, useState } from 'react'

export function shouldUseStaticExperience(
  prefersReducedMotion: boolean,
  hasWebGl: boolean,
) {
  return prefersReducedMotion || !hasWebGl
}

type WebGlContext = WebGLRenderingContext | WebGL2RenderingContext

function probeWebGl(): { supported: boolean; context: WebGlContext | null } {
  if (
    typeof document === 'undefined' ||
    (typeof WebGLRenderingContext === 'undefined' &&
      typeof WebGL2RenderingContext === 'undefined')
  ) {
    return { supported: false, context: null }
  }

  try {
    const canvas = document.createElement('canvas')
    const context =
      (canvas.getContext('webgl2') as WebGlContext | null) ??
      (canvas.getContext('webgl') as WebGlContext | null)

    return { supported: context !== null, context }
  } catch {
    return { supported: false, context: null }
  }
}

function readPreference() {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useReducedExperience() {
  const [staticExperience, setStaticExperience] = useState(true)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const { supported, context } = probeWebGl()
    const update = () => {
      setStaticExperience(
        shouldUseStaticExperience(mediaQuery?.matches ?? readPreference(), supported),
      )
    }

    update()
    mediaQuery?.addEventListener?.('change', update)

    return () => {
      mediaQuery?.removeEventListener?.('change', update)
      const loseContext = context?.getExtension('WEBGL_lose_context')
      loseContext?.loseContext()
    }
  }, [])

  return staticExperience
}
