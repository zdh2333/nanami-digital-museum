import { describe, expect, it } from 'vitest'
import {
  ENTRY_EMOJIS,
  REACTION_EMOJIS,
  guestbookLimits,
  isReactionEmoji,
} from './contracts'

describe('guestbook contracts', () => {
  it('exports the exact supported entry and reaction emoji sets', () => {
    const expected = ['🐈‍⬛', '🖤', '🐾', '😺', '✨']

    expect(ENTRY_EMOJIS).toEqual(expected)
    expect(REACTION_EMOJIS).toEqual(expected)
  })

  it('exports the agreed guestbook limits', () => {
    expect(guestbookLimits).toEqual({
      nicknameMin: 1,
      nicknameMax: 24,
      messageMin: 1,
      messageMax: 500,
      photoMaxBytes: 5 * 1024 * 1024,
      pageSize: 12,
      entryLimit: 3,
      reactionLimit: 24,
      rateWindowMs: 10 * 60 * 1000,
    })
  })

  it.each(['🐈‍⬛', '🖤', '🐾', '😺', '✨'])('accepts %s as a reaction emoji', (emoji) => {
    expect(isReactionEmoji(emoji)).toBe(true)
  })

  it.each(['🐱', '❤️', '', 'nanami', '🐈‍⬛ '])('rejects %s as a reaction emoji', (emoji) => {
    expect(isReactionEmoji(emoji)).toBe(false)
  })
})
