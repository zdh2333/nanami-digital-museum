const HERO_ALT =
  'Nanami sitting in a dark room and looking directly at the camera.'

export function HeroPortrait() {
  return (
    <picture className="hero-portrait">
      <img
        src="/hero/nanami-cinematic-hero.webp"
        alt={HERO_ALT}
        width="1672"
        height="941"
        {...{ fetchpriority: 'high' }}
        decoding="async"
      />
    </picture>
  )
}
