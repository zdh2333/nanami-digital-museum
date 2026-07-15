import { describe, expect, it } from 'vitest'

import type { ArchiveItemInput } from '../src/archive/types'
import { archiveItems } from '../src/archive/items'
import { validateArchive } from '../src/archive/validate'

const validPhoto = (overrides: Partial<ArchiveItemInput> = {}): ArchiveItemInput => ({
  id: 'nanami-window-watch',
  type: 'photo',
  src: '/archive/nanami-window-watch.webp',
  caption: 'Nanami watching the street from her window.',
  alt: 'Black cat Nanami sitting at a window',
  faceChecked: true,
  featured: true,
  order: 1,
  ...overrides,
})

describe('validateArchive', () => {
  it('rejects an item without completed human-face review', () => {
    expect(() => validateArchive([validPhoto({ faceChecked: false })])).toThrow(
      /face review/i,
    )
  })

  it('requires the face review marker to be the literal boolean true', () => {
    expect(() =>
      validateArchive([
        validPhoto({ faceChecked: 'yes' as unknown as boolean }),
      ]),
    ).toThrow(/face review/i)
  })

  it('rejects duplicate archive IDs', () => {
    expect(() =>
      validateArchive([
        validPhoto(),
        validPhoto({ src: '/archive/nanami-window-watch-2.webp', order: 2 }),
      ]),
    ).toThrow(/duplicate.*nanami-window-watch/i)
  })

  it('rejects assets outside the public archive path', () => {
    expect(() => validateArchive([validPhoto({ src: '/photos/nanami.webp' })])).toThrow(
      /\/archive\//i,
    )
  })

  it.each([
    '/archive/%2e%2e/private.jpg',
    '%2Farchive/nanami.jpg',
    '/archive/%2E%2e/private.jpg',
    '/archive/%252e%252e/private.jpg',
    '/archive/safe%2F..%2Fprivate.jpg',
    '/archive/%5c..%5cprivate.jpg',
    '/archive/./private.jpg',
    '/archive/nanami.jpg?source=private',
    '/archive/nanami.jpg#private',
    '/archive/nanami%3Fprivate.jpg',
    '/archive/nanami%23private.jpg',
    '/archive/incomplete%',
    '/archive/incomplete%2',
    '/archive/invalid%zz.jpg',
  ])('rejects unsafe or malformed encoded archive path %s', (src) => {
    expect(() => validateArchive([validPhoto({ src })])).toThrow(/archive.*path/i)
  })

  it.each([
    ['blank ID', { id: '   ' }, /id/i],
    ['malformed ID', { id: 'Nanami Cat!' }, /id/i],
    ['blank caption', { caption: '' }, /caption/i],
    ['blank alt text', { alt: '  ' }, /alt/i],
    ['invalid type', { type: 'video' }, /type/i],
    ['invalid featured marker', { featured: 'yes' }, /featured/i],
    ['invalid order', { order: -1 }, /order/i],
    ['fractional order', { order: 1.5 }, /order/i],
  ] as const)('rejects %s', (_label, overrides, expectedMessage) => {
    expect(() =>
      validateArchive([validPhoto(overrides as unknown as Partial<ArchiveItemInput>)]),
    ).toThrow(expectedMessage)
  })

  it('returns a validated, immutable collection', () => {
    const photo = validPhoto()
    const meme = validPhoto({
      id: 'nanami-door-inspector',
      type: 'meme',
      src: '/archive/nanami-door-inspector.webp',
      caption: 'Every closed door is a personal affront.',
      alt: 'Nanami inspecting a closed door',
      displayDate: '2026-07',
      featured: false,
      order: 2,
    })

    const archive = validateArchive([photo, meme])

    expect(archive).toEqual([photo, meme])
    expect(Object.isFrozen(archive)).toBe(true)
  })

  it('clones and freezes each item so validated invariants cannot be mutated later', () => {
    const input = validPhoto()
    const archive = validateArchive([input])

    input.faceChecked = false
    input.src = '/private/original.jpg'

    expect(archive[0].faceChecked).toBe(true)
    expect(archive[0].src).toBe('/archive/nanami-window-watch.webp')
    expect(Object.isFrozen(archive[0])).toBe(true)
  })
})

describe('archiveItems', () => {
  it('exports the curated collection as an immutable validated archive', () => {
    expect(archiveItems).toHaveLength(19)
    expect(archiveItems.every(({ faceChecked }) => faceChecked)).toBe(true)
    expect(Object.isFrozen(archiveItems)).toBe(true)
    expect(archiveItems.every((item) => Object.isFrozen(item))).toBe(true)
  })
})
