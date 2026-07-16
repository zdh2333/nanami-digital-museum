import { useEffect } from 'react'

import { useLocale } from '../i18n/LocaleProvider'
import {
  canonicalUrl,
  metadataByLocale,
  socialImageUrl,
} from '../i18n/metadata'
import { nanamiProfile } from '../profile/nanami'

const jsonLdId = 'nanami-structured-data'

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    document.head.append(element)
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
}

function upsertCanonical() {
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = canonicalUrl
}

function structuredData() {
  const subjectId = `${canonicalUrl}#nanami`
  const place = nanamiProfile.birthplace

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${canonicalUrl}#website`,
        url: canonicalUrl,
        name: 'Nanami Cat',
        about: { '@id': subjectId },
      },
      {
        '@type': 'Thing',
        '@id': subjectId,
        name: nanamiProfile.name,
        gender: nanamiProfile.sex,
        birthDate: nanamiProfile.birthDate,
        birthPlace: {
          '@type': 'Place',
          name: [place.city, place.region, place.country].join(', '),
          address: {
            '@type': 'PostalAddress',
            addressLocality: place.city,
            addressRegion: place.region,
            addressCountry: place.country,
          },
        },
        disambiguatingDescription: `A ${nanamiProfile.alive ? 'living ' : ''}${nanamiProfile.coat} ${nanamiProfile.species}.`,
        additionalProperty: [
          {
            '@type': 'PropertyValue',
            name: 'alive',
            value: nanamiProfile.alive,
          },
        ],
      },
    ],
  }
}

export function SeoMetadata() {
  const { locale } = useLocale()

  useEffect(() => {
    const metadata = metadataByLocale[locale]
    document.title = metadata.title
    upsertCanonical()

    upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description })
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: metadata.openGraphLocale })
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: socialImageUrl })
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: metadata.description })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImageUrl })

    let script = document.head.querySelector<HTMLScriptElement>(`#${jsonLdId}`)
    if (!script) {
      script = document.createElement('script')
      script.id = jsonLdId
      script.type = 'application/ld+json'
      document.head.append(script)
    }
    script.textContent = JSON.stringify(structuredData())

    return () => {
      if (script?.parentNode === document.head) script.remove()
    }
  }, [locale])

  return null
}
