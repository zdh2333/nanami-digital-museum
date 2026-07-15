import { SectionReveal } from './SectionReveal'

type MoodArchiveProps = { staticExperience: boolean }

export function MoodArchive({ staticExperience }: MoodArchiveProps) {
  return (
    <section id="mood-archive" className="museum-section mood-archive" aria-labelledby="mood-archive-title">
      <SectionReveal className="mood-archive__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Expressions, documented</p>
        <h2 id="mood-archive-title">MOOD ARCHIVE</h2>
        <p>Nanami’s everyday expressions, gathered into a living visual index.</p>
      </SectionReveal>
      <div className="mood-archive__frames" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  )
}
