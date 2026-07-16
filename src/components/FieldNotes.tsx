import { SectionReveal } from './SectionReveal'

const notes = [
  {
    term: 'YELLOW-GREEN EYES',
    detail: 'Always first to notice movement.',
    observed: 'Her gaze shifts from sleepy to fully alert in a single sound.',
    image: '/archive/photos/nanami-photo-003-640.webp',
    alt: 'Close portrait of Nanami resting on grey bedding with her yellow-green eyes open.',
  },
  {
    term: 'RIGHT-ANGLE TAIL',
    detail: 'Her unmistakable signature.',
    observed: 'The tip finishes with a crisp right-angle turn that makes her silhouette unmistakably Nanami.',
    image: '/archive/photos/nanami-photo-012-640.webp',
    alt: 'Nanami stretched across a striped bed with her body and tail visible.',
  },
  {
    term: 'RED COLLAR',
    detail: 'A bright line against midnight fur.',
    observed: 'The small flash of red is usually the first clue that she has entered the room.',
    image: '/archive/photos/nanami-photo-002-640.webp',
    alt: 'Nanami standing on the edge of a bed wearing her red collar.',
  },
  {
    term: 'ZERO CLOSED DOORS',
    detail: 'Privacy remains a human theory.',
    observed: 'Beds, chairs and high corners are inspected until every room meets her standards.',
    image: '/archive/photos/nanami-photo-007-640.webp',
    alt: 'Nanami watching from a raised bed nook between two white panels.',
  },
] as const

type FieldNotesProps = { staticExperience: boolean }

export function FieldNotes({ staticExperience }: FieldNotesProps) {
  return (
    <section id="field-notes" data-museum-section="field-notes" className="anchor-target museum-section field-notes" aria-labelledby="field-notes-title">
      <SectionReveal className="field-notes__intro" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Observed daily</p>
        <h2 id="field-notes-title">FIELD NOTES</h2>
      </SectionReveal>
      <div className="field-notes__list">
        {notes.map((note, index) => (
          <div
            key={note.term}
            className="field-note"
            role="group"
            aria-labelledby={`field-note-${index + 1}`}
          >
            <figure className="field-note__media">
              <img
                src={note.image}
                alt={note.alt}
                width="640"
                height="853"
                loading="lazy"
                decoding="async"
              />
            </figure>
            <div className="field-note__copy">
              <span className="field-note__index">0{index + 1}</span>
              <p id={`field-note-${index + 1}`} className="field-note__term">
                {note.term}
              </p>
              <p className="field-note__detail">{note.detail}</p>
              <p className="field-note__observed">
                <span>Observed:</span> {note.observed}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
