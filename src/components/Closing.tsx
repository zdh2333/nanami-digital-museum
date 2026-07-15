import { SectionReveal } from './SectionReveal'

type ClosingProps = { staticExperience: boolean }

export function Closing({ staticExperience }: ClosingProps) {
  return (
    <section id="closing" data-museum-section="closing" className="anchor-target museum-section closing" aria-labelledby="closing-title">
      <div className="closing__gaze" aria-hidden="true"><i /><i /></div>
      <SectionReveal className="closing__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">End of page · not of patrol</p>
        <h2 id="closing-title">Nanami is probably watching you.</h2>
        <a href="#hero">Return to her territory</a>
      </SectionReveal>
      <div className="tail-signature" aria-hidden="true" />
    </section>
  )
}
