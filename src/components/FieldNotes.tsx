import { SectionReveal } from './SectionReveal'

const notes = [
  ['YELLOW-GREEN EYES', 'Always first to notice movement.'],
  ['RIGHT-ANGLE TAIL', 'Her unmistakable signature.'],
  ['RED COLLAR', 'A bright line against midnight fur.'],
  ['ZERO CLOSED DOORS', 'Privacy remains a human theory.'],
] as const

type FieldNotesProps = { staticExperience: boolean }

export function FieldNotes({ staticExperience }: FieldNotesProps) {
  return (
    <section id="field-notes" className="anchor-target museum-section field-notes" aria-labelledby="field-notes-title">
      <SectionReveal className="field-notes__intro" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Observed daily</p>
        <h2 id="field-notes-title">FIELD NOTES</h2>
      </SectionReveal>
      <dl className="field-notes__list">
        {notes.map(([term, detail]) => (
          <div key={term} className="field-note">
            <dt>{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
