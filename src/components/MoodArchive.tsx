import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { archiveItems } from '../archive/items'
import type { ArchiveItem, ArchiveType } from '../archive/types'
import { ArchiveViewer } from './ArchiveViewer'
import { SectionReveal } from './SectionReveal'

type MoodArchiveProps = {
  staticExperience: boolean
  items?: readonly ArchiveItem[]
}

type ArchiveFilter = 'all' | ArchiveType

const filters: readonly { value: ArchiveFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'meme', label: 'Memes' },
]

const archiveCardSizes = '(max-width: 767px) min(75vw, 304px), (max-width: 1000px) 240px, (max-width: 1333px) 24vw, 320px'

function ArchiveCard({
  item,
  onOpen,
}: {
  item: ArchiveItem
  onOpen: (opener: HTMLButtonElement) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [item.src640, item.src1600])

  return (
    <button
      className="archive-card"
      type="button"
      aria-label={`View ${item.caption.en}`}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span className="archive-card__image">
        {imageFailed ? (
          <span
            className="archive-image-placeholder"
            role="status"
            aria-label="Image unavailable"
          >
            <span>Image unavailable</span>
          </span>
        ) : (
          <img
            src={item.src640}
            srcSet={`${item.src640} 640w, ${item.src1600} 1600w`}
            sizes={archiveCardSizes}
            alt={item.alt.en}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <span className="archive-card__meta">
        <span className="museum-label text-ink">{item.type}</span>
        <span>{item.caption.en}</span>
        {item.captureDate ? <time dateTime={item.captureDate}>{item.captureDate}</time> : null}
      </span>
    </button>
  )
}

export function MoodArchive({
  staticExperience,
  items = archiveItems,
}: MoodArchiveProps) {
  const [filter, setFilter] = useState<ArchiveFilter>('all')
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const filteredItems = useMemo(
    () => items.filter((item) => filter === 'all' || item.type === filter),
    [filter, items],
  )

  const closeViewer = useCallback(() => setActiveItemId(null), [])
  const getFocusFallback = useCallback(() => {
    const section = sectionRef.current
    return (
      section?.querySelector<HTMLElement>('.archive-card') ??
      section?.querySelector<HTMLElement>('.mood-archive__filters button') ??
      section
    )
  }, [])

  return (
    <section ref={sectionRef} id="mood-archive" data-museum-section="mood-archive" className="anchor-target museum-section mood-archive" aria-labelledby="mood-archive-title" tabIndex={-1}>
      <SectionReveal className="mood-archive__copy" staticExperience={staticExperience}>
        <p className="museum-label text-ink">Expressions, documented</p>
        <h2 id="mood-archive-title">MOOD ARCHIVE</h2>
        <p>Nanami’s everyday expressions, gathered into a living visual index.</p>
      </SectionReveal>

      {items.length === 0 ? (
        <div className="mood-archive__empty">
          <p className="museum-label text-ink">Archive in progress</p>
          <p>This living collection is being carefully curated.</p>
        </div>
      ) : (
        <div className="mood-archive__gallery">
          <div className="mood-archive__filters" aria-label="Filter mood archive">
            {filters.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value)
                  closeViewer()
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {filteredItems.length === 0 ? (
            <p className="mood-archive__filter-empty">This part of the archive is still being curated.</p>
          ) : (
            <div className="mood-archive__ribbon" aria-label="Nanami mood archive">
              {filteredItems.map((item) => (
                <ArchiveCard
                  key={item.id}
                  item={item}
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
