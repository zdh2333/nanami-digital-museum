import { archiveItems } from '../archive/items'
import { useLocale } from '../i18n/LocaleProvider'

type ArchiveRibbonProps = {
  staticExperience: boolean
}

const photoFrames = archiveItems
  .filter((item) => item.type === 'photo')
  .slice(0, 8)

const memeFrames = archiveItems
  .filter((item) => item.type === 'meme')
  .slice(0, 6)

function ArchiveRibbonRow({
  items,
  direction,
  label,
  locale,
}: {
  items: typeof archiveItems
  direction: 'forward' | 'reverse'
  label: string
  locale: 'en' | 'zh-CN'
}) {
  const loop = [...items, ...items]

  return (
    <div className={`archive-ribbon__row archive-ribbon__row--${direction}`}>
      <p className="archive-ribbon__label museum-label">{label}</p>
      <div className="archive-ribbon__viewport">
        <div className="archive-ribbon__track">
          {loop.map((item, index) => {
            const duplicate = index >= items.length

            return (
              <figure
                className="archive-ribbon__frame"
                key={`${item.id}-${index}`}
                aria-hidden={duplicate || undefined}
              >
                <img
                  src={item.src640}
                  alt={duplicate ? '' : item.alt[locale]}
                  width="640"
                  height="853"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>{item.caption[locale]}</figcaption>
              </figure>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ArchiveRibbon({ staticExperience }: ArchiveRibbonProps) {
  const { locale, copy } = useLocale()

  return (
    <aside
      className="archive-ribbon"
      aria-label={copy.archive.ribbonLabel}
      data-static-experience={staticExperience || undefined}
    >
      <ArchiveRibbonRow
        items={photoFrames}
        direction="forward"
        label={copy.archive.photos}
        locale={locale}
      />
      <ArchiveRibbonRow
        items={memeFrames}
        direction="reverse"
        label={copy.archive.memes}
        locale={locale}
      />
    </aside>
  )
}
