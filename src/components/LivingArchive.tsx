import type { MouseEvent } from 'react'

import {
  collectionCounts,
  latestCaptureDate,
  representativeItem,
} from '../archive/collections'
import { formatArchiveDate } from '../archive/date'
import { archiveItems } from '../archive/items'
import type { ArchiveCollection, ArchiveItem } from '../archive/types'
import { collectionUrl } from '../archive/url'
import { formatBirthplace } from '../i18n/copy'
import { useLocale } from '../i18n/LocaleProvider'
import { getNanamiAge, nanamiProfile } from '../profile/nanami'
import { SectionReveal } from './SectionReveal'

const directory = ['photos', 'memes', 'portraits'] as const satisfies readonly ArchiveCollection[]

type LivingArchiveProps = {
  staticExperience: boolean
  items?: readonly ArchiveItem[]
  now?: Date
}

function isUnmodifiedActivation(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && event.currentTarget.target !== '_blank'
}

export function LivingArchive({
  staticExperience,
  items = archiveItems,
  now = new Date(),
}: LivingArchiveProps) {
  const { locale, copy } = useLocale()
  const counts = collectionCounts(items)
  const latest = latestCaptureDate(items)
  const currentYear = Number(new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(now))
  const birthplace = formatBirthplace(
    nanamiProfile.birthplace,
    copy.profile.birthplaceLocalization,
  )

  return (
    <section id="living-archive" data-museum-section="living-archive" className="anchor-target museum-section living-archive" aria-labelledby="living-archive-title">
      <SectionReveal className="living-archive__heading" staticExperience={staticExperience}>
        <p className="museum-label text-ink">{copy.living.eyebrow}</p>
        <h2 id="living-archive-title">{copy.living.title}</h2>
        <p className="living-archive__summary">{copy.living.summary}</p>
        <dl className="living-archive__timeline" aria-label={copy.living.timelineLabel} role="list">
          <div>
            <dt>{copy.living.born}</dt>
            <dd>
              <time dateTime={nanamiProfile.birthDate}>
                {copy.profile.formatBirthDate(nanamiProfile.birthDate)}
              </time>{' · '}{birthplace}
            </dd>
          </div>
          <div>
            <dt>{copy.living.currentAge}</dt>
            <dd>{copy.living.formatCurrentAge(currentYear, getNanamiAge(now))}</dd>
          </div>
          {latest ? (
            <div>
              <dt>{copy.living.latestCapture}</dt>
              <dd><time dateTime={latest}>{formatArchiveDate(latest, locale)}</time></dd>
            </div>
          ) : null}
        </dl>
      </SectionReveal>
      <div className="living-archive__collections">
        {directory.map((collection) => {
          const item = representativeItem(items, collection)
          const name = copy.archive[collection]
          const href = collectionUrl(
            collection,
            typeof window === 'undefined' ? '' : window.location.search,
          )

          return (
            <article key={collection} className="collection-line">
              <a
                href={href}
                aria-label={copy.living.formatCollectionLabel(counts[collection], name)}
                onClick={(event) => {
                  if (!isUnmodifiedActivation(event)) return
                  event.preventDefault()
                  window.history.pushState(null, '', event.currentTarget.href)
                  window.dispatchEvent(new PopStateEvent('popstate'))
                  window.requestAnimationFrame(() => {
                    const target = document.querySelector<HTMLElement>('#mood-archive')
                    target?.scrollIntoView()
                    target?.focus({ preventScroll: true })
                  })
                }}
              >
                <span className="collection-line__preview">
                  {item ? (
                    <img
                      src={item.src640}
                      alt={item.alt[locale]}
                      width="640"
                      height="853"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : null}
                </span>
                <span className="collection-line__count">{counts[collection]}</span>
                <span className="collection-line__copy">
                  <span className="collection-line__name">{name}</span>
                  <span>{copy.living.collectionDescriptions[collection]}</span>
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </a>
            </article>
          )
        })}
      </div>
    </section>
  )
}
