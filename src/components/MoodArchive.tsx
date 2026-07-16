import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { archiveFilters, filterArchive } from '../archive/collections'
import { formatArchiveDate } from '../archive/date'
import { archiveItems } from '../archive/items'
import type { ArchiveFilter, ArchiveItem } from '../archive/types'
import { collectionFromLocation, collectionUrl } from '../archive/url'
import type { MuseumCopy } from '../i18n/copy'
import { useLocale } from '../i18n/LocaleProvider'
import type { Locale } from '../i18n/types'
import { ArchiveViewer } from './ArchiveViewer'
import { SectionReveal } from './SectionReveal'

type MoodArchiveProps = {
  staticExperience: boolean
  items?: readonly ArchiveItem[]
}

const archiveCardSizes = '(max-width: 767px) min(75vw, 304px), (max-width: 1000px) 240px, (max-width: 1333px) 24vw, 320px'

function ArchiveCard({
  item,
  onOpen,
  locale,
  archiveCopy,
}: {
  item: ArchiveItem
  onOpen: (opener: HTMLButtonElement) => void
  locale: Locale
  archiveCopy: MuseumCopy['archive']
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const viewId = `archive-card-${item.id}-view`
  const captionId = `archive-card-${item.id}-caption`
  const typeId = `archive-card-${item.id}-type`
  const dateId = `archive-card-${item.id}-date`
  const locationId = `archive-card-${item.id}-location`

  useEffect(() => setImageFailed(false), [item.src640, item.src1600])

  return (
    <button
      className="archive-card"
      type="button"
      aria-labelledby={`${viewId} ${captionId}`}
      aria-describedby={`${typeId} ${dateId}${item.location ? ` ${locationId}` : ''}`}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span id={viewId} className="visually-hidden">{archiveCopy.view}</span>
      <span className="archive-card__image">
        {imageFailed ? (
          <span className="archive-image-placeholder" role="status" aria-label={archiveCopy.imageUnavailable}>
            <span>{archiveCopy.imageUnavailable}</span>
          </span>
        ) : (
          <img
            src={item.src640}
            srcSet={`${item.src640} 640w, ${item.src1600} 1600w`}
            sizes={archiveCardSizes}
            alt={item.alt[locale]}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <span className="archive-card__meta">
        <span id={typeId} className="museum-label text-ink">{archiveCopy[item.type]}</span>
        <span id={captionId}>{item.caption[locale]}</span>
        {item.captureDate ? (
          <span id={dateId} className="archive-card__date">
            <span className="visually-hidden">{archiveCopy.date}</span>
            <time dateTime={item.captureDate}>{formatArchiveDate(item.captureDate, locale)}</time>
          </span>
        ) : <span id={dateId} className="archive-card__date-missing">{archiveCopy.missingDate}</span>}
        {item.location ? (
          <span id={locationId} className="archive-card__location">
            <span className="museum-label text-ink">{archiveCopy.location}</span>
            <span>{item.location[locale]}</span>
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function MoodArchive({ staticExperience, items = archiveItems }: MoodArchiveProps) {
  const { locale, copy } = useLocale()
  const [filter, setFilter] = useState<ArchiveFilter>(() =>
    typeof window === 'undefined' ? 'all' : collectionFromLocation(window.location.search),
  )
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const filteredItems = useMemo(() => filterArchive(items, filter), [filter, items])

  const closeViewer = useCallback(() => setActiveItemId(null), [])
  const getFocusFallback = useCallback(() => {
    const section = sectionRef.current
    return (
      section?.querySelector<HTMLElement>('.archive-card') ??
      section?.querySelector<HTMLElement>('.mood-archive__filters button') ??
      section
    )
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const restoreFilter = () => {
      setFilter(collectionFromLocation(window.location.search))
      closeViewer()
    }
    window.addEventListener('popstate', restoreFilter)
    return () => window.removeEventListener('popstate', restoreFilter)
  }, [closeViewer])

  return (
    <section ref={sectionRef} id="mood-archive" data-museum-section="mood-archive" className="anchor-target museum-section mood-archive" aria-labelledby="mood-archive-title" tabIndex={-1}>
      <SectionReveal className="mood-archive__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">{copy.archive.eyebrow}</p>
        <h2 id="mood-archive-title">{copy.archive.title}</h2>
        <p>{copy.archive.summary}</p>
      </SectionReveal>

      {items.length === 0 ? (
        <div className="mood-archive__empty">
          <p className="museum-label text-ink">{copy.archive.emptyTitle}</p>
          <p>{copy.archive.empty}</p>
        </div>
      ) : (
        <div className="mood-archive__gallery">
          <div className="mood-archive__filters" aria-label={copy.archive.filterLabel}>
            {archiveFilters.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  closeViewer()
                  if (value === filter) return
                  setFilter(value)
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', collectionUrl(value, window.location.search))
                  }
                }}
              >
                {copy.archive[value]}
              </button>
            ))}
          </div>
          {filteredItems.length === 0 ? (
            <p className="mood-archive__filter-empty">{copy.archive.filterEmpty}</p>
          ) : (
            <div className="mood-archive__ribbon" aria-label={copy.archive.ribbonLabel}>
              {filteredItems.map((item) => (
                <ArchiveCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  archiveCopy={copy.archive}
                  onOpen={(openingButton) => {
                    setOpener(openingButton)
                    setActiveItemId(item.id)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeItemId !== null ? (
        <ArchiveViewer
          items={filteredItems}
          activeItemId={activeItemId}
          onActiveItemChange={setActiveItemId}
          onClose={closeViewer}
          returnFocusTo={opener}
          returnFocusFallback={getFocusFallback}
        />
      ) : null}
    </section>
  )
}
