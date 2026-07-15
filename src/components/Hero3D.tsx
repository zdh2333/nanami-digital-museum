import {
  Component,
  lazy,
  Suspense,
  useCallback,
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
      width="1080"
      height="1440"
      className={`hero-poster h-full w-full object-cover object-center${hidden ? ' hero-poster--hidden' : ''}`}
    />
  )
}

type Hero3DProps = {
  staticExperience: boolean
}

export function Hero3D({ staticExperience }: Hero3DProps) {
  const [modelReady, setModelReady] = useState(false)
  const [interactiveFailed, setInteractiveFailed] = useState(false)
  const handleReady = useCallback(() => setModelReady(true), [])
  const handleFailure = useCallback((_error: Error) => {
    setModelReady(false)
    setInteractiveFailed(true)
  }, [])

  if (staticExperience) return <NanamiPoster />

  return (
    <div className="hero-3d-stage">
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
    </div>
  )
}
