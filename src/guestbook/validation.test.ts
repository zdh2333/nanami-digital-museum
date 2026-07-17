import { describe, expect, it } from 'vitest'
import { ENTRY_EMOJIS, guestbookLimits } from './contracts'
import {
  GuestbookValidationError,
  parseEntryFields,
  validatePhoto,
  validatePhotoSignature,
} from './validation'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
])

describe('guestbook submission validation', () => {
  it('normalizes and trims a plain-text entry without changing URL text', () => {
    expect(parseEntryFields({
      nickname: '  Nana\u0308mi  ',
      message: '  cafe\u0301 \uD83D\uDC3E https://nanamicat.com/  ',
      emoji: '\uD83D\uDC3E',
    })).toEqual({
      nickname: 'Nanämi',
      message: 'café \uD83D\uDC3E https://nanamicat.com/',
      emoji: '\uD83D\uDC3E',
    })
  })

  it.each([
    ['nickname', { nickname: '<b>x</b>', message: 'hello', emoji: '\uD83D\uDC3E' }, 'Nickname contains markup'],
    ['message', { nickname: 'x', message: 'hello <script>', emoji: '\uD83D\uDC3E' }, 'Message contains markup'],
  ])('rejects %s markup rather than returning text that could be interpreted as HTML', (_, fields, message) => {
    expect(() => parseEntryFields(fields)).toThrow(message)
  })

  it.each([
    ['nickname high surrogate', { nickname: 'Nanami\uD800', message: 'hello', emoji: '' }, 'Nickname contains malformed Unicode'],
    ['nickname low surrogate', { nickname: 'Nanami\uDC00', message: 'hello', emoji: '' }, 'Nickname contains malformed Unicode'],
    ['message high surrogate', { nickname: 'Nanami', message: 'hello\uD800', emoji: '' }, 'Message contains malformed Unicode'],
    ['message low surrogate', { nickname: 'Nanami', message: 'hello\uDC00', emoji: '' }, 'Message contains malformed Unicode'],
  ])('rejects a lone UTF-16 surrogate in %s before persistence', (_, fields, message) => {
    expect(() => parseEntryFields(fields)).toThrow(message)
  })

  it.each([
    ['nickname', { nickname: '   ', message: 'hello', emoji: '' }, 'Nickname is required'],
    ['message', { nickname: 'x', message: '   ', emoji: '' }, 'Message is required'],
    ['emoji', { nickname: 'x', message: 'hello', emoji: '\uD83D\uDD25' }, 'Emoji is not allowed'],
  ])('rejects an invalid %s field with a recoverable validation error', (_, fields, message) => {
    expect(() => parseEntryFields(fields)).toThrow(message)
    expect(() => parseEntryFields(fields)).toThrow(GuestbookValidationError)
  })

  it('enforces inclusive nickname and message character limits after Unicode normalization', () => {
    expect(parseEntryFields({
      nickname: 'n'.repeat(guestbookLimits.nicknameMax),
      message: 'm'.repeat(guestbookLimits.messageMax),
      emoji: '',
    })).toEqual({
      nickname: 'n'.repeat(guestbookLimits.nicknameMax),
      message: 'm'.repeat(guestbookLimits.messageMax),
      emoji: '',
    })

    expect(() => parseEntryFields({
      nickname: 'n'.repeat(guestbookLimits.nicknameMax + 1),
      message: 'hello',
      emoji: '',
    })).toThrow('Nickname must be 24 characters or fewer')

    expect(() => parseEntryFields({
      nickname: 'Nanami',
      message: 'm'.repeat(guestbookLimits.messageMax + 1),
      emoji: '',
    })).toThrow('Message must be 500 characters or fewer')
  })

  it.each(ENTRY_EMOJIS)('accepts %s as an entry emoji', (emoji) => {
    expect(parseEntryFields({ nickname: 'Nanami', message: 'hello', emoji }).emoji).toBe(emoji)
  })

  it('identifies only JPEG, PNG, and WebP signatures', () => {
    expect(validatePhotoSignature(jpeg)).toBe('image/jpeg')
    expect(validatePhotoSignature(png)).toBe('image/png')
    expect(validatePhotoSignature(webp)).toBe('image/webp')
    expect(validatePhotoSignature(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull()
    expect(validatePhotoSignature(new TextEncoder().encode('<svg'))).toBeNull()
    expect(validatePhotoSignature(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))).toBeNull()
  })

  it.each([
    ['image/jpeg', jpeg, jpeg.byteLength],
    ['image/png', png, png.byteLength],
    ['image/webp', webp, webp.byteLength],
  ] as const)('accepts a matching %s MIME type within the upload limit', (declaredMime, bytes, size) => {
    expect(validatePhoto({ declaredMime, bytes, size })).toBe(declaredMime)
  })

  it.each([
    ['image/gif', new Uint8Array([0x47, 0x49, 0x46, 0x38]), 4, 'Photo MIME type is not allowed'],
    ['image/svg+xml', new TextEncoder().encode('<svg'), 4, 'Photo MIME type is not allowed'],
    ['image/avif', new Uint8Array([0, 0, 0, 0]), 4, 'Photo MIME type is not allowed'],
    ['image/png', jpeg, jpeg.byteLength, 'Photo MIME type does not match the file signature'],
    ['image/jpeg', jpeg, guestbookLimits.photoMaxBytes + 1, 'Photo exceeds the 5 MiB limit'],
  ] as const)('rejects unsupported, mismatched, or oversized uploads', (declaredMime, bytes, size, message) => {
    expect(() => validatePhoto({ declaredMime, bytes, size })).toThrow(message)
  })
})
