import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { canvasProps, controls } = vi.hoisted(() => ({
  canvasProps: {} as Record<string, unknown>,
  controls: {
    canvasShouldThrow: false,
    renderCanvasChildren: false,
    gltfPromise: null as Promise<never> | null,
    gltfError: null as Error | null,
  },
}))

vi.mock('@react-three/fiber', async () => {
  const React = await import('react')

  return {
    Canvas: (props: Record<string, unknown>) => {
      if (controls.canvasShouldThrow) throw new Error('Canvas failed')

      const canvas = React.useRef<HTMLCanvasElement>(null)
      React.useEffect(() => {
        ;(props.onCreated as ((state: unknown) => void) | undefined)?.({
          gl: { domElement: canvas.current },
        })
      }, [props.onCreated])
      Object.assign(canvasProps, props)

      const modelBoundary = controls.renderCanvasChildren
        ? React.Children.toArray(props.children as React.ReactNode).at(-1)
        : null

      return (
        <>
          <canvas ref={canvas} aria-hidden="true" />
          {modelBoundary}
        </>
      )
    },
    useFrame: vi.fn(),
  }
})

vi.mock('@react-three/drei', () => ({
  Environment: () => null,
  Lightformer: () => null,
  useGLTF: Object.assign(
    vi.fn(() => {
      if (controls.gltfError) throw controls.gltfError
      if (controls.gltfPromise) throw controls.gltfPromise
      return { scene: { clone: () => ({}) } }
    }),
    { preload: vi.fn() },
  ),
}))

import { Hero3D } from './Hero3D'
import {
  canAnimateModel,
  clampPointerRotation,
  getNanamiPlacement,
  getNanamiModelUrl,
  getNextKeyboardYaw,
} from './NanamiModel'

describe('Hero3D', () => {
  beforeEach(() => {
    controls.canvasShouldThrow = false
    controls.renderCanvasChildren = false
    controls.gltfPromise = null
    controls.gltfError = null
    for (const key of Object.keys(canvasProps)) delete canvasProps[key]
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the accessible poster without creating a WebGL canvas for the static experience', () => {
    const { container } = render(<Hero3D staticExperience />)

    const poster = screen.getByAltText(
      'Nanami, a black cat with yellow-green eyes and a kinked tail tip',
    )

    expect(poster).toHaveAttribute('src', '/posters/nanami-hero.webp')
    expect(poster).toHaveAttribute('width', '1080')
    expect(poster).toHaveAttribute('height', '1440')
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('loads the interactive portrait when the full experience is available', async () => {
    render(<Hero3D staticExperience={false} />)

    expect(
      await screen.findByLabelText('Interactive 3D portrait of Nanami'),
    ).toBeInTheDocument()
    expect(canvasProps.dpr).toEqual([1, 1.75])
    expect(canvasProps.camera).toEqual({ position: [0, 1.1, 4.5], fov: 32 })
  })

  it('keeps the accessible poster visible while the GLB is loading', async () => {
    render(<Hero3D staticExperience={false} />)

    await screen.findByLabelText('Interactive 3D portrait of Nanami')
    expect(
      screen.getByAltText(
        'Nanami, a black cat with yellow-green eyes and a kinked tail tip',
      ),
    ).toBeVisible()
  })

  it('hides the poster only after the model reports that it is ready', async () => {
    controls.renderCanvasChildren = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { container } = render(<Hero3D staticExperience={false} />)

    const poster = container.querySelector('.hero-poster')
    expect(poster).toBeInTheDocument()
    await waitFor(() => expect(poster).toHaveClass('hero-poster--hidden'))
    expect(poster).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('restores the poster when Canvas rendering fails', async () => {
    controls.canvasShouldThrow = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const diagnostic = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', preventExpectedError)

    render(<Hero3D staticExperience={false} />)

    expect(
      await screen.findByAltText(
        'Nanami, a black cat with yellow-green eyes and a kinked tail tip',
      ),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Interactive 3D portrait of Nanami'),
      ).not.toBeInTheDocument(),
    )
    expect(diagnostic).toHaveBeenCalledTimes(1)
    expect(diagnostic).toHaveBeenCalledWith(
      'Nanami 3D unavailable; using the poster fallback.',
      expect.objectContaining({ message: 'Canvas failed' }),
    )
    window.removeEventListener('error', preventExpectedError)
  })

  it('restores the poster when the model promise rejects', async () => {
    controls.renderCanvasChildren = true
    let rejectModel!: (error: Error) => void
    controls.gltfPromise = new Promise<never>((_resolve, reject) => {
      rejectModel = reject
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', preventExpectedError)

    render(<Hero3D staticExperience={false} />)

    await screen.findByLabelText('Interactive 3D portrait of Nanami')
    const modelError = new Error('GLB failed')
    controls.gltfError = modelError
    rejectModel(modelError)

    expect(
      await screen.findByAltText(
        'Nanami, a black cat with yellow-green eyes and a kinked tail tip',
      ),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Interactive 3D portrait of Nanami'),
      ).not.toBeInTheDocument(),
    )
    window.removeEventListener('error', preventExpectedError)
  })

  it('restores the poster after the WebGL context is lost', async () => {
    const diagnostic = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { container } = render(<Hero3D staticExperience={false} />)
    const canvas = await waitFor(() => {
      const element = container.querySelector('canvas')
      expect(element).toBeInTheDocument()
      return element as HTMLCanvasElement
    })

    fireEvent(canvas, new Event('webglcontextlost', { cancelable: true }))

    expect(
      await screen.findByAltText(
        'Nanami, a black cat with yellow-green eyes and a kinked tail tip',
      ),
    ).toBeVisible()
    await waitFor(() =>
      expect(container.querySelector('canvas')).not.toBeInTheDocument(),
    )
    expect(diagnostic).toHaveBeenCalledTimes(1)
    expect(diagnostic).toHaveBeenCalledWith(
      'Nanami 3D unavailable; using the poster fallback.',
      expect.objectContaining({ message: 'WebGL context lost' }),
    )
  })

  it('selects only the mobile model for compact viewports', () => {
    expect(getNanamiModelUrl(true)).toBe('/models/nanami-mobile.glb')
    expect(getNanamiModelUrl(false)).toBe('/models/nanami.glb')
  })

  it('uses a full-silhouette placement on compact viewports', () => {
    expect(getNanamiPlacement(true)).toEqual({
      position: [0, 0, 0],
      scale: 0.56,
      yaw: 1.13,
    })
    expect(getNanamiPlacement(false)).toEqual({
      position: [0.04, 0, 0],
      scale: 1.1,
      yaw: 1.13,
    })
  })

  it('clamps pointer influence to a subtle rotation', () => {
    expect(clampPointerRotation(2, -2)).toEqual({ x: -0.08, y: 0.18 })
  })

  it('stops animation while the page is hidden or motion is reduced', () => {
    expect(canAnimateModel(false, false)).toBe(true)
    expect(canAnimateModel(true, false)).toBe(false)
    expect(canAnimateModel(false, true)).toBe(false)
  })

  it('supports clamped keyboard rotation without trapping unrelated keys', () => {
    expect(getNextKeyboardYaw(0, 'ArrowRight')).toBe(0.12)
    expect(getNextKeyboardYaw(0, 'ArrowLeft')).toBe(-0.12)
    expect(getNextKeyboardYaw(0.7, 'ArrowRight')).toBe(0.72)
    expect(getNextKeyboardYaw(0.3, 'Tab')).toBe(0.3)
  })
})
