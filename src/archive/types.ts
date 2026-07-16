import type { LocalizedText } from '../i18n/types'

export type ArchiveType = 'photo' | 'meme'
export type ArchiveCollection = 'photos' | 'memes' | 'portraits'
export type ArchiveFilter = 'all' | ArchiveCollection

export interface ArchiveItemInput {
  id: string
  type: ArchiveType
  collections: readonly ArchiveCollection[]
  src640: string
  src1600: string
  caption: LocalizedText
  alt: LocalizedText
  captureDate?: string
  location?: LocalizedText
  story: LocalizedText
  faceChecked: boolean
  featured: boolean
  order: number
}

export type ArchiveItem = Readonly<
  Omit<ArchiveItemInput, 'faceChecked'> & { faceChecked: true }
>
