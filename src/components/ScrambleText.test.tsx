import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ScrambleText } from './ScrambleText'

afterEach(() => {
  vi.useRealTimers()
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
