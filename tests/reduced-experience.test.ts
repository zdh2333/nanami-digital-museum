import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { shouldUseStaticExperience } from '../src/hooks/useReducedExperience'

beforeEach(() => {
  vi.resetModules()
})

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
  it('tracks reduced-motion changes after a single WebGL probe', async () => {
    let prefersReducedMotion = false
    const changeListeners: Array<() => void> = []
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
          changeListeners.push(listener)
        }),
        removeEventListener,
      })),
    )
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as WebGLRenderingContext)
    const { useReducedExperience } = await import(
      '../src/hooks/useReducedExperience'
    )

    const { result, unmount } = renderHook(() => [
      useReducedExperience(),
      useReducedExperience(),
    ])
    expect(result.current).toEqual([false, false])
    expect(getContext).toHaveBeenCalledTimes(1)
    expect(loseContext).toHaveBeenCalledTimes(1)

    prefersReducedMotion = true
    act(() => changeListeners.forEach((listener) => listener()))
    expect(result.current).toEqual([true, true])

    unmount()
    expect(removeEventListener).toHaveBeenCalledTimes(2)
  })

  it('fails safely to the static experience when probing WebGL throws', async () => {
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
    const { useReducedExperience } = await import(
      '../src/hooks/useReducedExperience'
    )

    const { result } = renderHook(() => useReducedExperience())

    expect(result.current).toBe(true)
  })

  it('uses and cleans up legacy MediaQueryList listeners', async () => {
    let prefersReducedMotion = false
    let changeListener: (() => void) | undefined
    const removeListener = vi.fn()

    vi.stubGlobal('WebGLRenderingContext', class {})
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        get matches() {
          return prefersReducedMotion
        },
        addListener: vi.fn((listener) => {
          changeListener = listener
        }),
        removeListener,
      })),
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: vi.fn(() => null),
    } as unknown as WebGLRenderingContext)
    const { useReducedExperience } = await import(
      '../src/hooks/useReducedExperience'
    )

    const { result, unmount } = renderHook(() => useReducedExperience())
    expect(result.current).toBe(false)

    prefersReducedMotion = true
    act(() => changeListener?.())
    expect(result.current).toBe(true)

    unmount()
    expect(removeListener).toHaveBeenCalledTimes(1)
  })
})
