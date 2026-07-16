import { describe, expect, it } from 'vitest'

import { collectionCounts } from './collections'
import { archiveItems } from './items'

const expectedIds = [
  'nanami-photo-001', 'nanami-photo-002', 'nanami-photo-003', 'nanami-photo-004',
  'nanami-photo-005', 'nanami-photo-006', 'nanami-photo-007', 'nanami-photo-008',
  'nanami-photo-009', 'nanami-photo-012', 'nanami-photo-014', 'nanami-photo-015',
  'nanami-photo-016', 'nanami-meme-001', 'nanami-meme-002', 'nanami-meme-004',
  'nanami-meme-005', 'nanami-meme-007', 'nanami-meme-008', 'nanami-photo-017',
  'nanami-photo-018', 'nanami-photo-019',
] as const

describe('curated Nanami archive', () => {
  it('preserves all 16 photo and 6 meme IDs in source order', () => {
    expect(archiveItems.map(({ id }) => id)).toEqual(expectedIds)
    expect(archiveItems.filter(({ type }) => type === 'photo')).toHaveLength(16)
    expect(archiveItems.filter(({ type }) => type === 'meme')).toHaveLength(6)
    expect(archiveItems.map(({ order }) => order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 14, 15, 16, 17, 18, 20, 21, 23, 24, 25, 26, 27,
    ])
  })

  it('uses explicit metadata-free responsive source pairs', () => {
    for (const item of archiveItems) {
      const assetStem = `/archive/${item.type === 'photo' ? 'photos' : 'memes'}/${item.id}`
      expect(item.src640).toBe(`${assetStem}-640.webp`)
      expect(item.src1600).toBe(`${assetStem}-1600.webp`)
      expect(item.location).toBeUndefined()
    }
    expect(archiveItems.filter(({ captureDate }) => captureDate !== undefined).map(({ id, captureDate }) => ({ id, captureDate }))).toEqual([
      { id: 'nanami-photo-017', captureDate: '2026-06-19' },
      { id: 'nanami-photo-018', captureDate: '2026-06-22' },
      { id: 'nanami-photo-019', captureDate: '2026-06-22' },
    ])
  })

  it('localizes caption, factual alt text, and story in English and Simplified Chinese', () => {
    for (const item of archiveItems) {
      for (const field of [item.caption, item.alt, item.story]) {
        expect(field.en.trim()).not.toBe('')
        expect(field['zh-CN'].trim()).not.toBe('')
      }
    }
    expect(archiveItems.find(({ id }) => id === 'nanami-photo-001')?.alt.en).toBe(
      'Nanami, a black cat, resting on a green chair with one eye partly open.',
    )
    expect(archiveItems.find(({ id }) => id === 'nanami-photo-008')?.alt.en).toBe(
      'Nanami lying sideways in a raised bed nook.',
    )
    expect(archiveItems.find(({ id }) => id === 'nanami-photo-016')?.alt.en).toBe(
      'Nanami stretched across a striped bed.',
    )
  })

  it('uses no female pronouns or memorial language in archive copy', () => {
    const copy = archiveItems
      .flatMap(({ caption, alt, story }) => [caption.en, caption['zh-CN'], alt.en, alt['zh-CN'], story.en, story['zh-CN']])
      .join(' ')
    const incorrectEnglishPronouns = new RegExp(`\\b(?:${['s', 'he'].join('')}|${['h', 'er'].join('')}|${['h', 'ers'].join('')})\\b`, 'i')
    const incorrectChinesePronoun = String.fromCodePoint(0x5979)
    expect(copy).not.toMatch(incorrectEnglishPronouns)
    expect(copy).not.toContain(incorrectChinesePronoun)
    expect(copy).not.toMatch(/\b(?:memorial|deceased|late cat)\b/i)
    expect(copy).not.toMatch(/纪念|离世|去世/)
  })

  it('derives primary and portrait collections from real memberships', () => {
    expect(archiveItems.filter(({ type, collections }) => type === 'photo' && !collections.includes('photos'))).toEqual([])
    expect(archiveItems.filter(({ type, collections }) => type === 'meme' && !collections.includes('memes'))).toEqual([])

    const portraits = archiveItems.filter(({ collections }) => collections.includes('portraits'))
    expect(portraits.map(({ id }) => id)).toEqual(['nanami-photo-003', 'nanami-photo-006', 'nanami-photo-019'])
    expect(portraits.length).toBeGreaterThan(0)
    expect(portraits.length).toBeLessThan(16)
    expect(portraits.every(({ type }) => type === 'photo')).toBe(true)

    expect(collectionCounts(archiveItems)).toEqual({
      all: 22,
      photos: 16,
      memes: 6,
      portraits: portraits.length,
    })
  })
})
