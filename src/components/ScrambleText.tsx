import { useEffect, useState } from 'react'

import { useReducedExperience } from '../hooks/useReducedExperience'

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'

type ScrambleTextProps = {
  text: string
  className?: string
  staticExperience?: boolean
  stepDuration?: number
}

function scrambledFrame(text: string, revealedCharacters: number) {
  return Array.from(text, (character, index) => {
    if (character === ' ' || index < revealedCharacters) return character
    return GLYPHS[(index + revealedCharacters * 7) % GLYPHS.length]
  }).join('')
}

export function ScrambleText({
  text,
  className,
  staticExperience,
  stepDuration = 35,
}: ScrambleTextProps) {
  const detectedStaticExperience = useReducedExperience()
  const isStatic = staticExperience ?? detectedStaticExperience
  const [visualText, setVisualText] = useState(() =>
    isStatic ? text : scrambledFrame(text, 0),
  )

  useEffect(() => {
    if (isStatic) {
      setVisualText(text)
      return
    }

    let revealedCharacters = 0
    setVisualText(scrambledFrame(text, revealedCharacters))
    const timer = window.setInterval(() => {
      revealedCharacters += 1
      setVisualText(scrambledFrame(text, revealedCharacters))
      if (revealedCharacters >= text.length) window.clearInterval(timer)
    }, stepDuration)

    return () => window.clearInterval(timer)
  }, [isStatic, stepDuration, text])

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{visualText}</span>
    </span>
  )
}
