import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  shouldUseStaticExperience,
  useReducedExperience,
} from '../src/hooks/useReducedExperience'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('shouldUseStaticExperience', () => {
  it.each([
    { reducedMotion: true, hasWebGl: true, expected: true },
    { reducedMotion: false, hasWebGl: false, expected: true },
    { reducedMotion: false, hasWebGl: true, expected: false },
  ])(
    'returns $expected when reduced motion is $reducedMotion and WebGL support is $hasWebGl',
    ({ reducedMotion, hasWebGl, expected }) => {
      expect(shouldUseStaticExperience(reducedMotion, hasWebGl)).toBe(expected)
    },
  )
})

describe('useReducedExperience', () => {
  it('tracks reduced-motion changes after a single WebGL probe', () => {
    let prefersReducedMotion = false
    let changeListener: (() => void) | undefined
    const removeEventListener = vi.fn()
    const loseContext = vi.fn()
    const context = {
      getExtension: vi.fn(() => ({ loseContext })),
    }

    vi.stubGlobal('WebGLRenderingContext', class {})
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return prefersReducedMotion
        },
        addEventListener: vi.fn((_event, listener) => {
          changeListener = listener
        }),
        removeEventListener,
      })),
    )
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as WebGLRenderingContext)

    const { result, unmount } = renderHook(() => useReducedExperience())
    expect(result.current).toBe(false)
    expect(getContext).toHaveBeenCalledTimes(1)

    prefersReducedMotion = true
    act(() => changeListener?.())
    expect(result.current).toBe(true)

    unmount()
    expect(removeEventListener).toHaveBeenCalledTimes(1)
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('fails safely to the static experience when probing WebGL throws', () => {
    vi.stubGlobal('WebGLRenderingContext', class {})
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('GPU unavailable')
    })

    const { result } = renderHook(() => useReducedExperience())

    expect(result.current).toBe(true)
  })
})
