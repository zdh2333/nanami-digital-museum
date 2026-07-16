import { nanamiProfile } from '../profile/nanami'
import type { Locale } from './types'

export const canonicalUrl = 'https://nanamicat.com/'
export const socialImageUrl = `${canonicalUrl}social/nanami-social-card.webp`

export interface LocalizedMetadata {
  title: string
  description: string
  openGraphLocale: 'en_US' | 'zh_CN'
}

const birthplace = [
  nanamiProfile.birthplace.city,
  nanamiProfile.birthplace.region,
  nanamiProfile.birthplace.country,
].join(', ')

export const metadataByLocale: Readonly<Record<Locale, LocalizedMetadata>> = {
  en: {
    title: 'Nanami Cat — A Living Archive',
    description: `${nanamiProfile.name} is a living ${nanamiProfile.sex} ${nanamiProfile.coat} ${nanamiProfile.species} born in ${birthplace}. Explore his living digital archive.`,
    openGraphLocale: 'en_US',
  },
  'zh-CN': {
    title: 'Nanami Cat — 生活数字档案',
    description: 'Nanami 是一只出生于日本栃木县宇都宫市、正在生活中的雄性黑猫。这里是记录他日常与神态的生活数字档案。',
    openGraphLocale: 'zh_CN',
  },
}
