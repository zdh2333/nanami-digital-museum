import { nanamiProfile } from '../profile/nanami'
import type { Locale } from './types'

export const canonicalUrl = 'https://nanamicat.com/'
export const socialImageUrl = `${canonicalUrl}social/nanami-social-card.webp`

export interface LocalizedMetadata {
  title: string
  description: string
  openGraphLocale: 'en_US' | 'zh_CN'
}

export const metadataByLocale: Readonly<Record<Locale, LocalizedMetadata>> = {
  en: {
    title: 'Nanami Cat — A Living Archive',
    description: `The living digital archive of ${nanamiProfile.name}, a ${nanamiProfile.coat} ${nanamiProfile.species} born in ${nanamiProfile.birthplace.city}, ${nanamiProfile.birthplace.region}.`,
    openGraphLocale: 'en_US',
  },
  'zh-CN': {
    title: 'Nanami Cat — 生活数字档案',
    description: '黑猫 Nanami 的生活数字档案。他出生于日本栃木县宇都宫市。',
    openGraphLocale: 'zh_CN',
  },
}
