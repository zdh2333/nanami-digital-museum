import { archiveItems } from '../archive/items'
import { useLocale } from '../i18n/LocaleProvider'
import { SectionReveal } from './SectionReveal'

type ClosingProps = { staticExperience: boolean }

export function Closing({ staticExperience }: ClosingProps) {
  const { locale, copy } = useLocale()
  const portrait = archiveItems.find(({ id }) => id === 'nanami-photo-014')

  if (!portrait) throw new Error('Missing closing portrait nanami-photo-014.')

  return (
    <section id="closing" data-museum-section="closing" className="anchor-target museum-section closing" aria-labelledby="closing-title">
      <picture className="closing__portrait">
        <source
          media="(max-width: 767px)"
          srcSet={portrait.src640}
        />
        <img
          src={portrait.src1600}
          alt={portrait.alt[locale]}
          width="1365"
          height="2427"
          loading="lazy"
          decoding="async"
        />
      </picture>
      <SectionReveal className="closing__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">{copy.closing.eyebrow}</p>
        <h2 id="closing-title">{copy.closing.title}</h2>
        <a href="#hero">{copy.closing.returnLink}</a>
      </SectionReveal>
    </section>
  )
}
