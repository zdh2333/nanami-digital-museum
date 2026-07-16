import { SectionReveal } from './SectionReveal'

type ClosingProps = { staticExperience: boolean }

export function Closing({ staticExperience }: ClosingProps) {
  return (
    <section id="closing" data-museum-section="closing" className="anchor-target museum-section closing" aria-labelledby="closing-title">
      <picture className="closing__portrait">
        <source
          media="(max-width: 767px)"
          srcSet="/archive/photos/nanami-photo-014-640.webp"
        />
        <img
          src="/archive/photos/nanami-photo-014-1600.webp"
          alt="Close portrait of Nanami looking directly into the camera."
          width="1365"
          height="2427"
          loading="lazy"
          decoding="async"
        />
      </picture>
      <SectionReveal className="closing__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">End of page · not of patrol</p>
        <h2 id="closing-title">Nanami is probably watching you.</h2>
        <a href="#hero">Return to her territory</a>
      </SectionReveal>
    </section>
  )
}
