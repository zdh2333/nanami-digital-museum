import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react'

const NANAMI_DESCRIPTION =
  'Nanami, a black cat with yellow-green eyes and a kinked tail tip'

const NanamiExperience = lazy(() =>
  import('./NanamiModel').then((module) => ({
    default: module.NanamiExperience,
  })),
)

type Hero3DErrorBoundaryProps = {
  children: ReactNode
  onFailure: (error: Error) => void
}

type Hero3DErrorBoundaryState = {
  failed: boolean
}

class Hero3DErrorBoundary extends Component<
  Hero3DErrorBoundaryProps,
  Hero3DErrorBoundaryState
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    this.props.onFailure(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

type NanamiPosterProps = {
  hidden?: boolean
}

function NanamiPoster({ hidden = false }: NanamiPosterProps) {
  return (
    <img
      src="/posters/nanami-hero.webp"
      alt={hidden ? '' : NANAMI_DESCRIPTION}
      aria-hidden={hidden || undefined}
      width="1600"
      height="1000"
      className={`hero-poster hero-poster--contained${hidden ? ' hero-poster--hidden' : ''}`}
    />
  )
}

type Hero3DProps = {
  staticExperience: boolean
}

export function Hero3D({ staticExperience }: Hero3DProps) {
  const [modelReady, setModelReady] = useState(false)
  const [interactiveFailed, setInteractiveFailed] = useState(false)
  const failureLogged = useRef(false)
  const handleReady = useCallback(() => setModelReady(true), [])
  const handleFailure = useCallback((error: Error) => {
    if (!failureLogged.current) {
      failureLogged.current = true
      console.warn(
        'Nanami 3D unavailable; using the poster fallback.',
        error,
      )
    }
    setModelReady(false)
    setInteractiveFailed(true)
  }, [])

  if (staticExperience) return <NanamiPoster />

  return (
    <div className="hero-3d-stage" data-model-ready={modelReady && !interactiveFailed}>
      <NanamiPoster hidden={modelReady && !interactiveFailed} />
      {!interactiveFailed && (
        <div className="hero-3d-layer">
          <Hero3DErrorBoundary onFailure={handleFailure}>
            <Suspense fallback={null}>
              <NanamiExperience
                onReady={handleReady}
                onFailure={handleFailure}
              />
            </Suspense>
          </Hero3DErrorBoundary>
        </div>
      )}
      {modelReady && !interactiveFailed && (
        <span className="hero-3d-hint" aria-hidden="true">
          Drag to turn
        </span>
      )}
    </div>
  )
}
