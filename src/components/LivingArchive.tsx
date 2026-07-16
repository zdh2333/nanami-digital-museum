import { SectionReveal } from './SectionReveal'

const collections = [
  {
    name: 'Photos',
    count: '13',
    description: 'Unscripted daily life: beds, chairs, patrols and naps.',
    image: '/archive/photos/nanami-photo-001-640.webp',
    label: 'View 13 photos',
  },
  {
    name: 'Memes',
    count: '6',
    description: 'The expressions that became a language of their own.',
    image: '/archive/memes/nanami-meme-001-640.webp',
    label: 'View 6 memes',
  },
  {
    name: 'Portraits',
    count: '4',
    description: 'Close studies of her yellow-green eyes and midnight face.',
    image: '/archive/photos/nanami-photo-014-640.webp',
    label: 'View 4 close portraits',
  },
] as const

type LivingArchiveProps = { staticExperience: boolean }

export function LivingArchive({ staticExperience }: LivingArchiveProps) {
  return (
    <section id="living-archive" data-museum-section="living-archive" className="anchor-target museum-section living-archive" aria-labelledby="living-archive-title">
      <SectionReveal className="living-archive__heading" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Living archive</p>
        <h2 id="living-archive-title">Explore Nanami’s living archive.</h2>
        <p className="living-archive__summary">
          Candid photographs, familiar expressions and close portraits — all
          drawn from Nanami’s everyday life and still growing with her.
        </p>
      </SectionReveal>
      <div className="living-archive__collections">
        {collections.map((collection) => (
          <article key={collection.name} className="collection-line">
            <a href="#mood-archive" aria-label={collection.label}>
              <span className="collection-line__preview" aria-hidden="true">
                <img
                  src={collection.image}
                  alt=""
                  width="640"
                  height="853"
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className="collection-line__count">{collection.count}</span>
              <span className="collection-line__copy">
                <span className="collection-line__name">{collection.name}</span>
                <span>{collection.description}</span>
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
