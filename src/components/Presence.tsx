import { SectionReveal } from './SectionReveal'

type PresenceProps = { staticExperience: boolean }

export function Presence({ staticExperience }: PresenceProps) {
  return (
    <section id="presence" data-museum-section="presence" className="anchor-target museum-section presence" aria-labelledby="presence-title">
      <SectionReveal className="presence__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Presence · 01</p>
        <h2 id="presence-title">She runs the house.</h2>
        <p className="presence__note">
          Every room is hers. Every empty box is under review. Every quiet
          minute ends when Nanami decides it does.
        </p>
      </SectionReveal>
      <SectionReveal
        className="presence__media"
        delay={0.12}
        staticExperience={staticExperience}
      >
        <figure>
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/archive/photos/nanami-photo-002-640.webp"
            />
            <img
              src="/archive/photos/nanami-photo-002-640.webp"
              srcSet="/archive/photos/nanami-photo-002-640.webp 640w, /archive/photos/nanami-photo-002-1600.webp 1600w"
              sizes="(max-width: 767px) calc(100vw - 48px), 30vw"
              width="640"
              height="853"
              loading="lazy"
              decoding="async"
              alt="Nanami standing at the edge of a bed and looking directly at the camera."
            />
          </picture>
          <figcaption>
            <span>ROOM 01</span>
            <span>Claimed without discussion.</span>
          </figcaption>
        </figure>
        <div className="presence__orbit" aria-hidden="true">
          <span>territory</span>
          <i />
        </div>
      </SectionReveal>
    </section>
  )
}
