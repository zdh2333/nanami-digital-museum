import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ScrambleText } from './ScrambleText'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ScrambleText', () => {
  it('renders final text immediately for the static experience', () => {
    render(<ScrambleText text="Many moods." staticExperience />)

    const text = screen.getByLabelText('Many moods.')
    expect(text).toHaveTextContent('Many moods.')
    expect(text.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      'Many moods.',
    )
  })

  it('does not probe WebGL when the static experience is explicit', () => {
    vi.stubGlobal('WebGLRenderingContext', class {})
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')

    render(<ScrambleText text="Nanami" staticExperience />)

    expect(getContext).not.toHaveBeenCalled()
  })

  it('keeps final text accessible while the visual layer resolves', () => {
    vi.useFakeTimers()
    render(
      <ScrambleText
        text="Nanami"
        staticExperience={false}
        stepDuration={20}
      />,
    )

    const text = screen.getByLabelText('Nanami')
    const visualLayer = text.querySelector('[aria-hidden="true"]')

    expect(visualLayer).not.toHaveTextContent('Nanami')
    act(() => vi.runAllTimers())
    expect(visualLayer).toHaveTextContent('Nanami')
  })
})
