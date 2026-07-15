import { SectionReveal } from './SectionReveal'

const collections = [
  ['Photos', 'Unscripted daily life.'],
  ['Memes', 'The expressions that became a language.'],
  ['3D', 'A digital presence you can meet from every angle.'],
] as const

type LivingArchiveProps = { staticExperience: boolean }

export function LivingArchive({ staticExperience }: LivingArchiveProps) {
  return (
    <section id="living-archive" className="museum-section living-archive" aria-labelledby="living-archive-title">
      <SectionReveal className="living-archive__heading" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Living archive</p>
        <h2 id="living-archive-title">Three collections. Always growing.</h2>
      </SectionReveal>
      <div className="living-archive__collections">
        {collections.map(([name, description]) => (
          <article key={name} className="collection-line">
            <p className="collection-line__name">{name}</p>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
