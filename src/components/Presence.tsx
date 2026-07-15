import { SectionReveal } from './SectionReveal'

type PresenceProps = { staticExperience: boolean }

export function Presence({ staticExperience }: PresenceProps) {
  return (
    <section id="presence" className="museum-section presence" aria-labelledby="presence-title">
      <SectionReveal className="presence__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Presence · 01</p>
        <h2 id="presence-title">She runs the house.</h2>
        <p className="presence__note">
          Every room is hers. Every empty box is under review. Every quiet
          minute ends when Nanami decides it does.
        </p>
      </SectionReveal>
      <div className="presence__orbit" aria-hidden="true">
        <span>territory</span>
        <i />
      </div>
    </section>
  )
}
