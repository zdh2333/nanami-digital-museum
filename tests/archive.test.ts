import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  archiveFilters,
  collectionCounts,
  filterArchive,
  isArchiveFilter,
  latestCaptureDate,
  representativeItem,
} from '../src/archive/collections'
import { archiveItems } from '../src/archive/items'
import type { ArchiveCollection, ArchiveItemInput } from '../src/archive/types'
import { validateArchive } from '../src/archive/validate'

const localized = (en: string, zhCN = '七海正看着窗外。') => ({ en, 'zh-CN': zhCN })

const validPhoto = (overrides: Partial<ArchiveItemInput> = {}): ArchiveItemInput => ({
  id: 'nanami-window-watch',
  type: 'photo',
  collections: ['photos', 'portraits'],
  src640: '/archive/photos/nanami-window-watch-640.webp',
  src1600: '/archive/photos/nanami-window-watch-1600.webp',
  caption: localized('Window watch.'),
  alt: localized('Black cat Nanami sitting at a window.'),
  story: localized('A quiet watch over the street.'),
  faceChecked: true,
  featured: true,
  order: 1,
  ...overrides,
})

describe('validateArchive', () => {
  it('requires unique lowercase slug IDs and supported types', () => {
    expect(() => validateArchive([validPhoto({ id: 'Nanami Cat!' })])).toThrow(/id/i)
    expect(() => validateArchive([validPhoto({ type: 'video' as 'photo' })])).toThrow(/type/i)
    expect(() => validateArchive([validPhoto(), validPhoto({ order: 2 })])).toThrow(
      /duplicate.*nanami-window-watch/i,
    )
  })

  it.each([
    [[], /collection/i],
    [['photos', 'photos'], /collection/i],
    [['portraits'], /photos/i],
    [['memes'], /photos/i],
    [['photos', 'unknown'], /collection/i],
  ] as const)('rejects invalid photo memberships %j', (collections, message) => {
    expect(() => validateArchive([validPhoto({ collections })])).toThrow(message)
  })

  it('requires memes to belong only to memes', () => {
    const meme = validPhoto({
      id: 'nanami-serious-meme',
      type: 'meme',
      collections: ['memes'],
      src640: '/archive/memes/nanami-serious-meme-640.webp',
      src1600: '/archive/memes/nanami-serious-meme-1600.webp',
    })
    expect(validateArchive([meme])[0].collections).toEqual(['memes'])
    expect(() => validateArchive([meme, validPhoto({ id: 'wrong-meme', type: 'meme' })])).toThrow(
      /memes/i,
    )
  })

  it.each([
    ['photo plus memes', validPhoto({ collections: ['photos', 'memes'] })],
    ['meme plus photos', validPhoto({
      type: 'meme', collections: ['memes', 'photos'],
      src640: '/archive/memes/nanami-window-watch-640.webp',
      src1600: '/archive/memes/nanami-window-watch-1600.webp',
    })],
    ['meme plus portraits', validPhoto({
      type: 'meme', collections: ['memes', 'portraits'],
      src640: '/archive/memes/nanami-window-watch-640.webp',
      src1600: '/archive/memes/nanami-window-watch-1600.webp',
    })],
  ] as const)('rejects contradictory membership: %s', (_name, item) => {
    expect(() => validateArchive([item])).toThrow(/collection/i)
  })

  it.each([
    '/photos/nanami-640.webp',
    '/archive/%2e%2e/private-640.webp',
    '%2Farchive/photos/nanami-640.webp',
    '/archive/photos/%252e%252e/nanami-640.webp',
    '/archive/photos/safe%2F..%2Fprivate-640.webp',
    '/archive/photos/%5c..%5cprivate-640.webp',
    '/archive/photos/./private-640.webp',
    '/archive/photos/nanami-640.webp?private',
    '/archive/photos/nanami-640.webp#private',
    '/archive/photos/nanami\\-640.webp',
    '/archive/photos/nanami\0-640.webp',
    '/archive/photos/nanami\ncat-640.webp',
    '/archive/photos/nanami\tcat-640.webp',
    '/archive/photos/nanami\rcat-640.webp',
    '/archive/photos/nanami\u007fcat-640.webp',
    '/archive/photos/incomplete%-640.webp',
    '/archive/photos/nanami.jpg',
    '/archive/photos/nanami-1600.webp',
  ])('rejects an unsafe or wrongly sized 640 path %s', (src640) => {
    expect(() => validateArchive([validPhoto({ src640 })])).toThrow(/640.*archive.*path/i)
  })

  it.each([
    '/photos/nanami-1600.webp',
    '/archive/photos/../nanami-1600.webp',
    '/archive/photos/nanami%23private-1600.webp',
    '/archive/photos/nanami-1600.webp?private',
    '/archive/photos/nanami-1600.webp#private',
    '/archive/photos/nanami.webp',
    '/archive/photos/nanami-640.webp',
  ])('rejects an unsafe or wrongly sized 1600 path %s', (src1600) => {
    expect(() => validateArchive([validPhoto({ src1600 })])).toThrow(/1600.*archive.*path/i)
  })

  it('requires responsive paths to identify the same asset', () => {
    expect(() =>
      validateArchive([
        validPhoto({ src1600: '/archive/photos/a-different-cat-1600.webp' }),
      ]),
    ).toThrow(/responsive.*pair/i)
  })

  it.each([
    ['photo in the meme directory', validPhoto({
      src640: '/archive/memes/nanami-window-watch-640.webp',
      src1600: '/archive/memes/nanami-window-watch-1600.webp',
    })],
    ['meme in the photo directory', validPhoto({
      id: 'nanami-serious-meme', type: 'meme', collections: ['memes'],
      src640: '/archive/photos/nanami-serious-meme-640.webp',
      src1600: '/archive/photos/nanami-serious-meme-1600.webp',
    })],
  ] as const)('binds source directories to item type: %s', (_name, item) => {
    expect(() => validateArchive([item])).toThrow(/source.*type/i)
  })

  it('binds both responsive source basenames to the item ID', () => {
    expect(() => validateArchive([validPhoto({
      src640: '/archive/photos/a-different-cat-640.webp',
      src1600: '/archive/photos/a-different-cat-1600.webp',
    })])).toThrow(/source.*id/i)
  })

  it.each([
    ['caption', { caption: localized(' ') }, /caption.*en/i],
    ['caption zh-CN', { caption: localized('Caption', ' ') }, /caption.*zh-CN/i],
    ['alt', { alt: localized('') }, /alt.*en/i],
    ['story', { story: localized('Story', '') }, /story.*zh-CN/i],
    ['location', { location: localized('Tokyo', ' ') }, /location.*zh-CN/i],
  ] as const)('requires both localized values for %s', (_name, override, message) => {
    expect(() => validateArchive([validPhoto(override)])).toThrow(message)
  })

  it.each(['2021-02-30', '2021-2-03', '2021-13-01', 'not-a-date']) (
    'rejects invalid capture date %s',
    (captureDate) => {
      expect(() => validateArchive([validPhoto({ captureDate })])).toThrow(/capture date/i)
    },
  )

  it.each([
    ['0000-02-29', true],
    ['0099-01-01', true],
    ['0099-02-29', false],
    ['1900-02-29', false],
    ['2000-02-29', true],
  ] as const)('validates proleptic Gregorian date %s', (captureDate, valid) => {
    const validation = () => validateArchive([validPhoto({ captureDate })])
    if (valid) expect(validation).not.toThrow()
    else expect(validation).toThrow(/capture date/i)
  })

  it.each([
    ['featured', { featured: 'yes' }, /featured/i],
    ['negative order', { order: -1 }, /order/i],
    ['fractional order', { order: 1.5 }, /order/i],
    ['face review', { faceChecked: false }, /face review/i],
  ] as const)('rejects invalid %s', (_name, overrides, message) => {
    expect(() =>
      validateArchive([validPhoto(overrides as unknown as Partial<ArchiveItemInput>)]),
    ).toThrow(message)
  })

  it('deep-clones and freezes the collection and every nested value', () => {
    const input = validPhoto({ location: localized('Tokyo', '东京') })
    const archive = validateArchive([input])

    input.collections[0] = 'memes'
    input.caption.en = 'Changed'
    input.location!.en = 'Changed'

    expect(archive[0].collections).toEqual(['photos', 'portraits'])
    expect(archive[0].caption.en).toBe('Window watch.')
    expect(archive[0].location?.en).toBe('Tokyo')
    expect(Object.isFrozen(archive)).toBe(true)
    expect(Object.isFrozen(archive[0])).toBe(true)
    expect(Object.isFrozen(archive[0].collections)).toBe(true)
    expect(Object.isFrozen(archive[0].caption)).toBe(true)
    expect(Object.isFrozen(archive[0].alt)).toBe(true)
    expect(Object.isFrozen(archive[0].story)).toBe(true)
    expect(Object.isFrozen(archive[0].location)).toBe(true)
  })
})

describe('archive collection helpers', () => {
  const items = validateArchive([
    validPhoto({
      id: 'plain-photo', collections: ['photos'], featured: false, order: 1,
      src640: '/archive/photos/plain-photo-640.webp',
      src1600: '/archive/photos/plain-photo-1600.webp',
    }),
    validPhoto({
      id: 'featured-portrait',
      collections: ['photos', 'portraits'],
      src640: '/archive/photos/featured-portrait-640.webp',
      src1600: '/archive/photos/featured-portrait-1600.webp',
      featured: true,
      captureDate: '2024-02-29',
      order: 2,
    }),
    validPhoto({
      id: 'first-meme', type: 'meme', collections: ['memes'], featured: false,
      src640: '/archive/memes/first-meme-640.webp',
      src1600: '/archive/memes/first-meme-1600.webp', captureDate: '2025-01-03', order: 3,
    }),
  ])

  it('exposes the supported immutable filter list and guard', () => {
    expect(archiveFilters).toEqual(['all', 'photos', 'memes', 'portraits'])
    expect(Object.isFrozen(archiveFilters)).toBe(true)
    expect(archiveFilters.every(isArchiveFilter)).toBe(true)
    expect(isArchiveFilter('photo')).toBe(false)
    expect(isArchiveFilter(null)).toBe(false)
  })

  it('filters items by collection without mutating the source', () => {
    expect(filterArchive(items, 'all')).toEqual(items)
    expect(filterArchive(items, 'photos').map(({ id }) => id)).toEqual([
      'plain-photo', 'featured-portrait',
    ])
    expect(filterArchive(items, 'portraits').map(({ id }) => id)).toEqual([
      'featured-portrait',
    ])
  })

  it('derives immutable collection counts including all', () => {
    const counts = collectionCounts(items)
    expect(counts).toEqual({ all: 3, photos: 2, memes: 1, portraits: 1 })
    expect(Object.isFrozen(counts)).toBe(true)
  })

  it('finds the latest verified capture date and handles archives without dates', () => {
    expect(latestCaptureDate(items)).toBe('2025-01-03')
    expect(latestCaptureDate(validateArchive([validPhoto()]))).toBeUndefined()
  })

  it('selects the first featured representative, then the first item, then undefined', () => {
    expectTypeOf(representativeItem).parameter(1).toEqualTypeOf<ArchiveCollection>()
    expect(representativeItem(items, 'photos')?.id).toBe('featured-portrait')
    expect(representativeItem(items, 'memes')?.id).toBe('first-meme')
    expect(representativeItem(items, 'portraits')?.id).toBe('featured-portrait')
    expect(representativeItem([], 'photos')).toBeUndefined()
  })
})

describe('archiveItems', () => {
  it('exports the curated collection as an immutable validated archive', () => {
    expect(archiveItems).toHaveLength(22)
    expect(archiveItems.every(({ faceChecked }) => faceChecked)).toBe(true)
    expect(Object.isFrozen(archiveItems)).toBe(true)
    expect(archiveItems.every(Object.isFrozen)).toBe(true)
  })
})
