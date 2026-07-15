import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { canvasProps } = vi.hoisted(() => ({
  canvasProps: {} as Record<string, unknown>,
}))

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: Record<string, unknown>) => {
    Object.assign(canvasProps, props)
    return <canvas aria-label={props['aria-label'] as string} />
  },
  useFrame: vi.fn(),
}))

vi.mock('@react-three/drei', () => ({
  Environment: () => null,
  Lightformer: () => null,
  useGLTF: Object.assign(vi.fn(), { preload: vi.fn() }),
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
