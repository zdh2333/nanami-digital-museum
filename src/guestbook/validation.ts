import { type GuestbookEmoji, guestbookLimits, isReactionEmoji } from './contracts'

export type SupportedPhotoMime = 'image/jpeg' | 'image/png' | 'image/webp'

export interface EntryFieldsInput {
  nickname: unknown
  message: unknown
  emoji: unknown
}

export interface ParsedEntryFields {
  nickname: string
  message: string
  emoji: GuestbookEmoji | ''
}

export interface PhotoValidationInput {
  declaredMime: unknown
  bytes: Uint8Array
  size: number
}

export class GuestbookValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GuestbookValidationError'
  }
}

const supportedPhotoMimes: readonly SupportedPhotoMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

function fail(message: string): never {
  throw new GuestbookValidationError(message)
}

function normalizedPlainText(value: unknown, fieldName: 'Nickname' | 'Message'): string {
  if (typeof value !== 'string') {
    return fail(`${fieldName} must be text`)
  }

  const normalized = value.normalize('NFC').trim()

  if (/[<>]/.test(normalized)) {
    return fail(`${fieldName} contains markup`)
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
    return fail(`${fieldName} contains unsupported control characters`)
  }

  return normalized
}

function characterCount(value: string): number {
  return Array.from(value).length
}

function parseEmoji(value: unknown): GuestbookEmoji | '' {
  if (value === '') {
    return ''
  }

  if (typeof value !== 'string' || !isReactionEmoji(value.normalize('NFC'))) {
    return fail('Emoji is not allowed')
  }

  return value.normalize('NFC') as GuestbookEmoji
}

export function parseEntryFields(input: EntryFieldsInput): ParsedEntryFields {
  const nickname = normalizedPlainText(input.nickname, 'Nickname')
  const message = normalizedPlainText(input.message, 'Message')

  if (characterCount(nickname) < guestbookLimits.nicknameMin) {
    return fail('Nickname is required')
  }

  if (characterCount(nickname) > guestbookLimits.nicknameMax) {
    return fail(`Nickname must be ${guestbookLimits.nicknameMax} characters or fewer`)
  }

  if (characterCount(message) < guestbookLimits.messageMin) {
    return fail('Message is required')
  }

  if (characterCount(message) > guestbookLimits.messageMax) {
    return fail(`Message must be ${guestbookLimits.messageMax} characters or fewer`)
  }

  return { nickname, message, emoji: parseEmoji(input.emoji) }
}

export function validatePhotoSignature(bytes: Uint8Array): SupportedPhotoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

function parseDeclaredPhotoMime(value: unknown): SupportedPhotoMime {
  if (typeof value !== 'string') {
    return fail('Photo MIME type is required')
  }

  const mime = value.trim().toLowerCase()
  if (!supportedPhotoMimes.includes(mime as SupportedPhotoMime)) {
    return fail('Photo MIME type is not allowed')
  }

  return mime as SupportedPhotoMime
}

export function validatePhoto({ declaredMime, bytes, size }: PhotoValidationInput): SupportedPhotoMime {
  const mime = parseDeclaredPhotoMime(declaredMime)

  if (size > guestbookLimits.photoMaxBytes || bytes.byteLength > guestbookLimits.photoMaxBytes) {
    return fail('Photo exceeds the 5 MiB limit')
  }

  if (!Number.isSafeInteger(size) || size < 0 || size !== bytes.byteLength) {
    return fail('Photo size is invalid')
  }

  const signatureMime = validatePhotoSignature(bytes)
  if (signatureMime === null) {
    return fail('Photo file signature is not allowed')
  }

  if (signatureMime !== mime) {
    return fail('Photo MIME type does not match the file signature')
  }

  return mime
}
