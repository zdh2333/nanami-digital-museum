import { useEffect, useState } from 'react'

export function shouldUseStaticExperience(
  prefersReducedMotion: boolean,
  hasWebGl: boolean,
) {
  return prefersReducedMotion || !hasWebGl
}

type WebGlContext = WebGLRenderingContext | WebGL2RenderingContext

let cachedWebGlSupport: boolean | undefined

function releaseProbeContext(context: WebGlContext) {
  try {
    context.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    // Context release is best-effort; capability detection remains valid.
  }
}

function probeWebGl() {
  if (cachedWebGlSupport !== undefined) return cachedWebGlSupport

  if (
    typeof document === 'undefined' ||
    (typeof WebGLRenderingContext === 'undefined' &&
      typeof WebGL2RenderingContext === 'undefined')
  ) {
    cachedWebGlSupport = false
    return cachedWebGlSupport
  }

  try {
    const canvas = document.createElement('canvas')
    const context =
      (canvas.getContext('webgl2') as WebGlContext | null) ??
      (canvas.getContext('webgl') as WebGlContext | null)

    cachedWebGlSupport = context !== null
    if (context) releaseProbeContext(context)
    return cachedWebGlSupport
  } catch {
    cachedWebGlSupport = false
    return cachedWebGlSupport
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
    const supported = probeWebGl()
    const update = () => {
      setStaticExperience(
        shouldUseStaticExperience(mediaQuery?.matches ?? readPreference(), supported),
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
