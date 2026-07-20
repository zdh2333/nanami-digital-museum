import { archiveItems } from '../archive/items'
import { formatBirthplace } from '../i18n/copy'
import { useLocale } from '../i18n/LocaleProvider'
import { getNanamiAge, nanamiProfile } from '../profile/nanami'
import { navigationItems } from './navigationModel'
import { SectionReveal } from './SectionReveal'

type ProfileProps = { staticExperience: boolean }

const profilePhoto = (() => {
  const item = archiveItems.find((archiveItem) => archiveItem.id === 'nanami-photo-002')

  if (!item) {
    throw new Error('The reviewed Nanami profile photograph is missing.')
  }

  return item
})()

const profileBackdropPhoto = (() => {
  const item = archiveItems.find((archiveItem) => archiveItem.id === 'nanami-photo-003')

  if (!item) {
    throw new Error('The reviewed Nanami profile backdrop photograph is missing.')
  }

  return item
})()

const profileIndex = navigationItems.slice(2, 6)

export function Profile({ staticExperience }: ProfileProps) {
  const { locale, copy } = useLocale()
  const profileCopy = copy.profile
  const facts = [
    [profileCopy.age, profileCopy.formatAge(getNanamiAge())],
    [profileCopy.born, profileCopy.formatBirthDate(nanamiProfile.birthDate)],
    [
      profileCopy.birthplace,
      formatBirthplace(nanamiProfile.birthplace, profileCopy.birthplaceLocalization),
    ],
    [profileCopy.sex, profileCopy[nanamiProfile.sex]],
  ] as const

  return (
    <section id="presence" data-museum-section="presence" className="anchor-target museum-section presence" aria-labelledby="presence-title">
      <div className="presence__backdrop" aria-hidden="true">
        <img src={profileBackdropPhoto.src1600} alt="" width="1600" height="2133" decoding="async" />
      </div>
      <SectionReveal className="presence__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">{profileCopy.eyebrow}</p>
        <h2 id="presence-title">{profileCopy.title}</h2>
        <p className="presence__note">{profileCopy.summary}</p>
        <dl className="presence__facts">
          {facts.map(([label, value]) => (
            <div className="presence__fact" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
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
              srcSet={profilePhoto.src640}
            />
            <img
              src={profilePhoto.src640}
              srcSet={`${profilePhoto.src640} 640w, ${profilePhoto.src1600} 1600w`}
              sizes="(max-width: 767px) calc(100vw - 48px), 30vw"
              width="640"
              height="853"
              loading="lazy"
              decoding="async"
              alt={profilePhoto.alt[locale]}
            />
          </picture>
          <figcaption>
            <span>{profileCopy.room}</span>
            <span>{profileCopy.roomCaption}</span>
          </figcaption>
        </figure>
      </SectionReveal>
      <SectionReveal
        className="presence__index"
        delay={0.18}
        staticExperience={staticExperience}
      >
        <p className="museum-label text-ink">{profileCopy.eyebrow}</p>
        <nav aria-label={copy.nav.menu}>
          {profileIndex.map(({ key, href }, index) => (
            <a href={href} key={key}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{copy.nav[key]}</strong>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </a>
          ))}
        </nav>
      </SectionReveal>
    </section>
  )
}
