import { archiveItems } from '../archive/items'
import type { MuseumCopy } from '../i18n/copy'
import { useLocale } from '../i18n/LocaleProvider'
import { SectionReveal } from './SectionReveal'

const notes = [
  { copyKey: 'eyes', archiveId: 'nanami-photo-003' },
  { copyKey: 'tail', archiveId: 'nanami-photo-020' },
  { copyKey: 'collar', archiveId: 'nanami-photo-002' },
  { copyKey: 'doors', archiveId: 'nanami-photo-007' },
] as const

type NoteKey = keyof Pick<MuseumCopy['notes'], 'eyes' | 'tail' | 'collar' | 'doors'>

type FieldNotesProps = { staticExperience: boolean }

export function FieldNotes({ staticExperience }: FieldNotesProps) {
  const { locale, copy } = useLocale()

  return (
    <section id="field-notes" data-museum-section="field-notes" className="anchor-target museum-section field-notes" aria-labelledby="field-notes-title">
      <SectionReveal className="field-notes__intro" staticExperience={staticExperience}>
        <p className="museum-label text-ink">{copy.notes.eyebrow}</p>
        <h2 id="field-notes-title">{copy.notes.title}</h2>
      </SectionReveal>
      <div className="field-notes__list">
        {notes.map((note, index) => {
          const noteCopy = copy.notes[note.copyKey as NoteKey]
          const evidence = 'archiveId' in note
            ? archiveItems.find(({ id }) => id === note.archiveId)
            : undefined

          return (
          <div
            key={note.copyKey}
            className={`field-note${evidence ? '' : ' field-note--text-only'}`}
            role="group"
            aria-labelledby={`field-note-${index + 1}`}
          >
            {evidence ? <figure className="field-note__media">
              <img
                src={evidence.src640}
                alt={evidence.alt[locale]}
                width="640"
                height="853"
                loading="lazy"
                decoding="async"
              />
            </figure> : null}
            <div className="field-note__copy">
              <span className="field-note__index">0{index + 1}</span>
              <p id={`field-note-${index + 1}`} className="field-note__term">
                {noteCopy.term}
              </p>
              <p className="field-note__detail">{noteCopy.detail}</p>
              <p className="field-note__observed">
                <span>{evidence ? copy.notes.observed : copy.notes.ownerConfirmed}</span>{copy.notes.observationSeparator}{' '}
                {noteCopy.observation}
              </p>
            </div>
          </div>
          )
        })}
      </div>
    </section>
  )
}
