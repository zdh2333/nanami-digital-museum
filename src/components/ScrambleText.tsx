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

type ScrambleTextRendererProps = Omit<ScrambleTextProps, 'staticExperience'> & {
  staticExperience: boolean
}

function ScrambleTextRenderer({
  text,
  className,
  staticExperience,
  stepDuration = 35,
}: ScrambleTextRendererProps) {
  const [visualText, setVisualText] = useState(() =>
    staticExperience ? text : scrambledFrame(text, 0),
  )

  useEffect(() => {
    if (staticExperience) {
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
  }, [staticExperience, stepDuration, text])

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{visualText}</span>
    </span>
  )
}

function DetectedScrambleText(props: Omit<ScrambleTextProps, 'staticExperience'>) {
  const staticExperience = useReducedExperience()
  return <ScrambleTextRenderer {...props} staticExperience={staticExperience} />
}

export function ScrambleText({
  staticExperience,
  ...props
}: ScrambleTextProps) {
  if (staticExperience === undefined) return <DetectedScrambleText {...props} />
  return <ScrambleTextRenderer {...props} staticExperience={staticExperience} />
}
