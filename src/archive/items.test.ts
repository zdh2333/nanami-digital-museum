import { describe, expect, it } from 'vitest'

import { archiveItems } from './items'

describe('curated Nanami archive', () => {
  it('publishes the reviewed photo and meme collections', () => {
    expect(archiveItems.filter(({ type }) => type === 'photo')).toHaveLength(13)
    expect(archiveItems.filter(({ type }) => type === 'meme')).toHaveLength(6)
  })

  it('uses neutral IDs and metadata-free responsive display assets', () => {
    expect(archiveItems.map(({ id }) => id)).toEqual([
      'nanami-photo-001', 'nanami-photo-002', 'nanami-photo-003', 'nanami-photo-004',
      'nanami-photo-005', 'nanami-photo-006', 'nanami-photo-007', 'nanami-photo-008',
      'nanami-photo-009', 'nanami-photo-012', 'nanami-photo-014', 'nanami-photo-015',
      'nanami-photo-016',
      'nanami-meme-001', 'nanami-meme-002', 'nanami-meme-004', 'nanami-meme-005',
      'nanami-meme-007', 'nanami-meme-008',
    ])

    for (const item of archiveItems) {
      expect(item.src).toMatch(/^\/archive\/(photos|memes)\/nanami-(photo|meme)-\d{3}-1600\.webp$/)
      expect(item.faceChecked).toBe(true)
      expect(item.displayDate).toBeUndefined()
    }
  })
})
