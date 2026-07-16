import { describe, expect, it } from 'vitest'

import { collectionFromLocation, collectionUrl } from './url'

describe('archive collection URL helpers', () => {
  it.each([
    ['?collection=all', 'all'],
    ['?collection=photos', 'photos'],
    ['?collection=memes', 'memes'],
    ['?collection=portraits', 'portraits'],
    ['', 'all'],
    ['?collection=photo', 'all'],
    ['?collection=', 'all'],
  ] as const)('reads %s as %s', (search, expected) => {
    expect(collectionFromLocation(search)).toBe(expected)
  })

  it('sets an encoded collection while preserving unrelated parameters', () => {
    expect(collectionUrl('portraits', '?q=black+cat&note=%E4%B8%83%E6%B5%B7')).toBe(
      '?q=black+cat&note=%E4%B8%83%E6%B5%B7&collection=portraits#mood-archive',
    )
  })

  it('removes the collection for all and always targets the archive hash', () => {
    expect(collectionUrl('all', '?q=nanami&collection=memes')).toBe(
      '?q=nanami#mood-archive',
    )
    expect(collectionUrl('all', '')).toBe('#mood-archive')
  })
})
