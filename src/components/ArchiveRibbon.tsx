import { collectionCounts } from '../archive/collections'
import { archiveItems } from '../archive/items'
import { useLocale } from '../i18n/LocaleProvider'

type ArchiveRibbonProps = {
  staticExperience: boolean
}

const contactFrames = archiveItems
  .filter((item) => item.type === 'photo')
  .slice(0, 12)

export function ArchiveRibbon({ staticExperience }: ArchiveRibbonProps) {
  const { locale, copy } = useLocale()
  const counts = collectionCounts(archiveItems)

  return (
    <aside
      className="archive-ribbon"
      aria-label={copy.archive.ribbonLabel}
      data-static-experience={staticExperience || undefined}
    >
      <div className="archive-ribbon__header">
        <p className="archive-ribbon__label museum-label">{copy.archive.ribbonLabel}</p>
        <p className="archive-ribbon__counter">
          <span>{String(counts.photos).padStart(2, '0')}</span>
          {copy.archive.photos}
        </p>
      </div>

      <div className="archive-ribbon__viewport">
        <div className="archive-ribbon__track">
          {contactFrames.map((item, index) => (
            <figure className="archive-ribbon__frame" key={item.id}>
              <span className="archive-ribbon__number" aria-hidden="true">
                {String(index + 1).padStart(3, '0')}
              </span>
              <img
                src={item.src640}
                alt={item.alt[locale]}
                width="640"
                height="853"
                loading="lazy"
                decoding="async"
              />
              <figcaption>{item.caption[locale]}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="archive-ribbon__footer">
        <span>{copy.archive.photos}</span>
        <a href="?collection=photos#mood-archive">
          {copy.archive.photos}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
    </aside>
  )
}
