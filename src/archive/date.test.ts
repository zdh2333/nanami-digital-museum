import { describe, expect, it } from 'vitest'

import { formatArchiveDate } from './date'

describe('formatArchiveDate', () => {
  it('formats a calendar date without timezone shifting', () => {
    expect(formatArchiveDate('2026-06-19', 'en')).toBe('June 19, 2026')
    expect(formatArchiveDate('2026-06-19', 'zh-CN')).toBe('2026年6月19日')
  })

  it('preserves years below 100 instead of applying the Date constructor offset', () => {
    expect(formatArchiveDate('0099-01-01', 'en')).toBe('January 1, 99')
  })
})
