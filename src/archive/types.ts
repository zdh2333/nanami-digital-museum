export type ArchiveType = 'photo' | 'meme'

export interface ArchiveItemInput {
  id: string
  type: ArchiveType
  src: string
  caption: string
  alt: string
  displayDate?: string
  faceChecked: boolean
  featured: boolean
  order: number
}

export type ArchiveItem = ArchiveItemInput & { faceChecked: true }
