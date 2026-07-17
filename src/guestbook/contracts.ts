export const ENTRY_EMOJIS = ['🐈‍⬛', '🖤', '🐾', '😺', '✨'] as const

export const REACTION_EMOJIS = ENTRY_EMOJIS

export type GuestbookEmoji = (typeof ENTRY_EMOJIS)[number]

export const guestbookLimits = {
  nicknameMin: 1,
  nicknameMax: 24,
  messageMin: 1,
  messageMax: 500,
  photoMaxBytes: 5 * 1024 * 1024,
  pageSize: 12,
  entryLimit: 3,
  reactionLimit: 24,
  rateWindowMs: 10 * 60 * 1000,
} as const

export function isReactionEmoji(value: string): value is GuestbookEmoji {
  return REACTION_EMOJIS.includes(value as GuestbookEmoji)
}
