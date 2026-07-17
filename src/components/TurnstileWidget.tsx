import { useEffect, useRef, useState } from 'react'

interface TurnstileRenderOptions {
  sitekey: string
  theme: 'dark'
  size: 'normal' | 'compact'
  action: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const scriptId = 'nanami-turnstile-script'
const scriptUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
// The guestbook's paper desk has horizontal padding and borders. Keep the
// 300px normal widget out of its inner content width through 391px viewport.
const compactViewportMaxWidth = 391
let scriptLoadPromise: Promise<TurnstileApi> | undefined
let scriptLoadError: Error | undefined

function turnstileSizeForViewport(): TurnstileRenderOptions['size'] {
  return window.innerWidth <= compactViewportMaxWidth ? 'compact' : 'normal'
}

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) return Promise.resolve(window.turnstile)
  if (scriptLoadError !== undefined) return Promise.reject(scriptLoadError)
  if (scriptLoadPromise !== undefined) return scriptLoadPromise

  const existing = document.getElementById(scriptId) as HTMLScriptElement | null
  const script = existing ?? document.createElement('script')
  if (existing?.dataset.nanamiTurnstileState === 'failed') {
    scriptLoadError = new Error('Turnstile script could not load')
    return Promise.reject(scriptLoadError)
  }

  if (existing === null) {
    script.id = scriptId
    script.src = scriptUrl
    script.async = true
    script.defer = true
    script.dataset.nanamiTurnstileState = 'loading'
    document.head.append(script)
  }

  scriptLoadPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const complete = () => {
      if (window.turnstile === undefined) {
        reject(new Error('Turnstile script loaded without an API'))
        return
      }
      resolve(window.turnstile)
    }
    script.addEventListener('load', complete, { once: true })
    script.addEventListener('error', () => reject(new Error('Turnstile script could not load')), { once: true })
  }).then(
    (turnstile) => {
      script.dataset.nanamiTurnstileState = 'ready'
      return turnstile
    },
    (error: unknown) => {
      script.dataset.nanamiTurnstileState = 'failed'
      scriptLoadError = error instanceof Error
        ? error
        : new Error('Turnstile script could not load')
      throw scriptLoadError
    },
  )

  return scriptLoadPromise
}

type TurnstileWidgetProps = {
  siteKey: string
  onToken: (token: string | null) => void
  resetKey: number
  unavailableLabel: string
}

export function TurnstileWidget({
  siteKey,
  onToken,
  resetKey,
  unavailableLabel,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string>()
  const previousSizeRef = useRef<TurnstileRenderOptions['size']>()
  const [unavailable, setUnavailable] = useState(siteKey.trim() === '')
  const [size, setSize] = useState<TurnstileRenderOptions['size']>(turnstileSizeForViewport)

  useEffect(() => {
    const updateSize = () => setSize(turnstileSizeForViewport())
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    // A viewport transition replaces the embedded challenge. Its prior token
    // must not be reused after the widget is removed and rendered again.
    if (previousSizeRef.current !== undefined && previousSizeRef.current !== size) onToken(null)
    previousSizeRef.current = size
    if (siteKey.trim() === '') {
      onToken(null)
      setUnavailable(true)
      return
    }

    let active = true
    setUnavailable(false)
    void loadTurnstileScript()
      .then((turnstile) => {
        if (!active || containerRef.current === null) return
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size,
          action: 'guestbook-write',
          callback: (token) => active && onToken(token),
          'expired-callback': () => active && onToken(null),
          'error-callback': () => {
            if (!active) return
            onToken(null)
            setUnavailable(true)
          },
        })
      })
      .catch(() => {
        if (!active) return
        onToken(null)
        setUnavailable(true)
      })

    return () => {
      active = false
      if (widgetIdRef.current !== undefined && window.turnstile !== undefined) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = undefined
      }
    }
  }, [onToken, siteKey, size])

  useEffect(() => {
    if (resetKey === 0 || widgetIdRef.current === undefined || window.turnstile === undefined) return
    window.turnstile.reset(widgetIdRef.current)
    onToken(null)
  }, [onToken, resetKey])

  return (
    <div className="guestbook__verification">
      <div ref={containerRef} aria-label="Turnstile verification" />
      {unavailable ? <p role="status" className="guestbook__verification-status">{unavailableLabel}</p> : null}
    </div>
  )
}
