import { useLocale } from '../i18n/LocaleProvider'

export function HeroPortrait() {
  const { copy } = useLocale()

  return (
    <picture className="hero-portrait">
      <img
        src="/hero/nanami-cinematic-hero.webp"
        alt={copy.hero.alt}
        width="1672"
        height="941"
        {...{ fetchpriority: 'high' }}
        decoding="async"
      />
    </picture>
  )
}
