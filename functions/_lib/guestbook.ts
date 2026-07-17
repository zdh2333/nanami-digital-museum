import {
  guestbookLimits,
  isReactionEmoji,
  type GuestbookEmoji,
} from '../../src/guestbook/contracts'

export const GUESTBOOK_VISITOR_COOKIE = 'nanami_guestbook_visitor'

export type GuestbookPhotoStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type GuestbookRateAction = 'entry' | 'reaction'

export interface GuestbookEnv {
  DB: D1Database
  PHOTOS: R2Bucket
  IMAGE_SANITIZER: Fetcher
  TURNSTILE_SECRET_KEY: string
  TURNSTILE_EXPECTED_HOSTNAME?: string
  TURNSTILE_EXPECTED_ACTION?: string
  GUESTBOOK_HMAC_KEY: string
}

export type GuestbookStorageEnv = GuestbookEnv

export interface GuestbookEntryRecord {
  id: string
  nickname: string
  message: string
  entry_emoji: string | null
  photo_key: string | null
  photo_status: GuestbookPhotoStatus
  hidden: number
  created_at: number
}

export interface GuestbookReactionTotal {
  emoji: string
  total: number
}

export interface PublicGuestbookReaction {
  emoji: GuestbookEmoji
  total: number
}

export interface PublicGuestbookEntry {
  id: string
  nickname: string
  message: string
  emoji: GuestbookEmoji | null
  createdAt: number
  photoUrl: string | null
  reactions: PublicGuestbookReaction[]
}

export interface GuestbookCursor {
  createdAt: number
  id: string
}

export interface PublicGuestbookPage {
  entries: PublicGuestbookEntry[]
  nextCursor: string | null
}

export interface NewGuestbookEntry {
  id: string
  nickname: string
  message: string
  emoji: GuestbookEmoji | ''
  photoKey?: string | null
  photoStatus?: GuestbookPhotoStatus
  now: number
}

export interface SetGuestbookReactionInput {
  entryId: string
  visitorHash: string
  emoji: GuestbookEmoji
  active: boolean
  now: number
}

export interface GuestbookVisitor {
  visitorHash: string
  setCookie?: string
}

export class GuestbookRateLimitError extends Error {
  constructor() {
    super('Too many guestbook actions. Please try again later.')
    this.name = 'GuestbookRateLimitError'
  }
}

export class GuestbookRateIdentityError extends Error {
  constructor() {
    super('Guestbook write protection is unavailable')
    this.name = 'GuestbookRateIdentityError'
  }
}

export class GuestbookNotFoundError extends Error {
  constructor() {
    super('Guestbook entry not found')
    this.name = 'GuestbookNotFoundError'
  }
}

export class GuestbookCursorError extends Error {
  constructor() {
    super('Invalid guestbook cursor')
    this.name = 'GuestbookCursorError'
  }
}

export class GuestbookTurnstileError extends Error {
  constructor() {
    super('Turnstile verification failed')
    this.name = 'GuestbookTurnstileError'
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    return null
  }

  try {
    const padding = '='.repeat((4 - (value.length % 4)) % 4)
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    return null
  }
}

function parseCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader === null) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const [candidateName, ...valueParts] = part.trim().split('=')
    if (candidateName === name) {
      return valueParts.join('=') || null
    }
  }

  return null
}

function hmacPayload(prefix: string, value: string): Uint8Array {
  return new TextEncoder().encode(`${prefix}:${value}`)
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function hmacBase64Url(prefix: string, value: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), hmacPayload(prefix, value))
  return base64UrlEncode(new Uint8Array(signature))
}

async function hasValidCookieSignature(token: string, signature: string, secret: string): Promise<boolean> {
  const signatureBytes = base64UrlDecode(signature)
  if (signatureBytes === null) {
    return false
  }

  return crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signatureBytes,
    hmacPayload('cookie', token),
  )
}

function serializeVisitorCookie(token: string, signature: string): string {
  return `${GUESTBOOK_VISITOR_COOKIE}=${token}.${signature}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`
}

function isVisitorToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value)
}

/**
 * Returns a signed browser identity. The raw random token stays in the HttpOnly
 * cookie; callers receive only its HMAC-derived hash for D1 persistence.
 */
export async function getVisitor(
  request: Request,
  secret: string,
  createToken: () => string = () => crypto.randomUUID(),
): Promise<GuestbookVisitor> {
  const candidate = parseCookie(request, GUESTBOOK_VISITOR_COOKIE)
  if (candidate !== null) {
    const [token, signature, ...rest] = candidate.split('.')
    if (
      rest.length === 0
      && token !== undefined
      && signature !== undefined
      && isVisitorToken(token)
      && await hasValidCookieSignature(token, signature, secret)
    ) {
      return { visitorHash: await hmacBase64Url('visitor', token, secret) }
    }
  }

  const token = createToken()
  if (!isVisitorToken(token)) {
    throw new Error('Guestbook visitor token generator returned an invalid token')
  }

  const signature = await hmacBase64Url('cookie', token, secret)
  return {
    visitorHash: await hmacBase64Url('visitor', token, secret),
    setCookie: serializeVisitorCookie(token, signature),
  }
}

/**
 * Cloudflare sets CF-Connecting-IP before a Pages Function runs. Persist only
 * a keyed digest, never the raw address, so clearing browser cookies cannot
 * reset a writer's rate bucket.
 */
export async function getRateIdentity(request: Request, secret: string): Promise<string> {
  const address = request.headers.get('cf-connecting-ip')
  if (
    secret.trim() === ''
    || address === null
    || address.length === 0
    || address.length > 45
    || !/^[0-9A-Fa-f:.]+$/.test(address)
  ) {
    throw new GuestbookRateIdentityError()
  }

  return hmacBase64Url('rate-ip', address, secret)
}

export function getRateWindowStart(now: number): number {
  return now - guestbookLimits.rateWindowMs
}

export function getRateLimit(action: GuestbookRateAction): number {
  return action === 'entry' ? guestbookLimits.entryLimit : guestbookLimits.reactionLimit
}

interface CountRow {
  total: number | string
}

function countFromRow(row: CountRow | null): number {
  const count = Number(row?.total ?? 0)
  return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

/**
 * Applies the per-visitor action window before recording the action. Only the
 * caller-provided HMAC fingerprint is bound into D1, never a raw cookie token
 * or IP address.
 */
export async function enforceRateLimit(
  env: Pick<GuestbookEnv, 'DB'>,
  input: { fingerprintHash: string; action: GuestbookRateAction; now: number },
): Promise<void> {
  const windowStart = getRateWindowStart(input.now)
  await env.DB.prepare(
    'DELETE FROM guestbook_rate_events WHERE created_at < ?',
  ).bind(windowStart).run()

  const inserted = await env.DB.prepare(
    `INSERT INTO guestbook_rate_events (fingerprint_hash, action, created_at)
     SELECT ?, ?, ?
     WHERE (
       SELECT COUNT(*)
       FROM guestbook_rate_events
       WHERE fingerprint_hash = ? AND action = ? AND created_at >= ?
     ) < ?`,
  ).bind(
    input.fingerprintHash,
    input.action,
    input.now,
    input.fingerprintHash,
    input.action,
    windowStart,
    getRateLimit(input.action),
  ).run()

  if (Number(inserted.meta.changes ?? 0) !== 1) {
    throw new GuestbookRateLimitError()
  }
}

export function publicPhotoUrl(entry: Pick<GuestbookEntryRecord, 'id' | 'hidden' | 'photo_status'>): string | null {
  if (entry.hidden !== 0 || entry.photo_status !== 'approved') {
    return null
  }

  return `/api/guestbook/photos/${encodeURIComponent(entry.id)}`
}

function isPublicPhotoStatus(value: string): value is GuestbookPhotoStatus {
  return value === 'none' || value === 'pending' || value === 'approved' || value === 'rejected'
}

function publicEmoji(value: string | null): GuestbookEmoji | null {
  return value !== null && isReactionEmoji(value) ? value : null
}

export function serializePublicEntry(
  entry: GuestbookEntryRecord,
  reactions: readonly GuestbookReactionTotal[],
): PublicGuestbookEntry {
  return {
    id: entry.id,
    nickname: entry.nickname,
    message: entry.message,
    emoji: publicEmoji(entry.entry_emoji),
    createdAt: entry.created_at,
    photoUrl: publicPhotoUrl(entry),
    reactions: reactions.flatMap(({ emoji, total }) => {
      if (!isReactionEmoji(emoji) || !Number.isSafeInteger(total) || total < 1) {
        return []
      }

      return [{ emoji, total }]
    }),
  }
}

export function encodeGuestbookCursor(cursor: GuestbookCursor): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(cursor)))
}

export function decodeGuestbookCursor(cursor: string): GuestbookCursor {
  const decoded = base64UrlDecode(cursor)
  if (decoded === null) {
    throw new GuestbookCursorError()
  }

  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(decoded))
    if (
      typeof parsed !== 'object'
      || parsed === null
      || !('createdAt' in parsed)
      || !('id' in parsed)
      || typeof parsed.createdAt !== 'number'
      || !Number.isSafeInteger(parsed.createdAt)
      || typeof parsed.id !== 'string'
      || !/^[A-Za-z0-9_-]{1,128}$/.test(parsed.id)
    ) {
      throw new GuestbookCursorError()
    }

    return { createdAt: parsed.createdAt, id: parsed.id }
  } catch (error) {
    if (error instanceof GuestbookCursorError) {
      throw error
    }

    throw new GuestbookCursorError()
  }
}

function toEntryRecord(value: Record<string, unknown>): GuestbookEntryRecord {
  const photoStatus = typeof value.photo_status === 'string' && isPublicPhotoStatus(value.photo_status)
    ? value.photo_status
    : 'none'

  return {
    id: String(value.id),
    nickname: String(value.nickname),
    message: String(value.message),
    entry_emoji: typeof value.entry_emoji === 'string' ? value.entry_emoji : null,
    photo_key: typeof value.photo_key === 'string' ? value.photo_key : null,
    photo_status: photoStatus,
    hidden: Number(value.hidden) === 1 ? 1 : 0,
    created_at: Number(value.created_at),
  }
}

function toReactionTotal(value: Record<string, unknown>): GuestbookReactionTotal {
  return {
    emoji: String(value.emoji),
    total: Number(value.total),
  }
}

export async function listPublicGuestbookEntries(
  env: Pick<GuestbookEnv, 'DB'>,
  encodedCursor?: string | null,
): Promise<PublicGuestbookPage> {
  const cursor = encodedCursor === null || encodedCursor === undefined || encodedCursor === ''
    ? null
    : decodeGuestbookCursor(encodedCursor)
  const cursorClause = cursor === null
    ? ''
    : ' AND (created_at < ? OR (created_at = ? AND id < ?))'
  const values: (string | number)[] = cursor === null
    ? []
    : [cursor.createdAt, cursor.createdAt, cursor.id]

  const entryRows = await env.DB.prepare(
    `SELECT id, nickname, message, entry_emoji, photo_key, photo_status, hidden, created_at
     FROM guestbook_entries
     WHERE hidden = 0${cursorClause}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
  ).bind(...values, guestbookLimits.pageSize + 1).all<Record<string, unknown>>()
  const rows = (entryRows.results ?? []).map(toEntryRecord)
  const hasNextPage = rows.length > guestbookLimits.pageSize
  const visibleRows = rows.slice(0, guestbookLimits.pageSize)

  const reactionsByEntry = new Map<string, GuestbookReactionTotal[]>()
  if (visibleRows.length > 0) {
    const placeholders = visibleRows.map(() => '?').join(', ')
    const reactionRows = await env.DB.prepare(
      `SELECT entry_id, emoji, COUNT(*) AS total
       FROM guestbook_reactions
       WHERE entry_id IN (${placeholders})
       GROUP BY entry_id, emoji`,
    ).bind(...visibleRows.map(({ id }) => id)).all<Record<string, unknown>>()

    for (const value of reactionRows.results ?? []) {
      const entryId = typeof value.entry_id === 'string' ? value.entry_id : ''
      const current = reactionsByEntry.get(entryId) ?? []
      current.push(toReactionTotal(value))
      reactionsByEntry.set(entryId, current)
    }
  }

  const lastVisible = visibleRows.at(-1)
  return {
    entries: visibleRows.map((entry) => serializePublicEntry(entry, reactionsByEntry.get(entry.id) ?? [])),
    nextCursor: hasNextPage && lastVisible !== undefined
      ? encodeGuestbookCursor({ createdAt: lastVisible.created_at, id: lastVisible.id })
      : null,
  }
}

function buildGuestbookEntry(input: NewGuestbookEntry): GuestbookEntryRecord {
  const photoStatus = input.photoStatus ?? (input.photoKey === undefined || input.photoKey === null ? 'none' : 'pending')
  return {
    id: input.id,
    nickname: input.nickname,
    message: input.message,
    entry_emoji: input.emoji || null,
    photo_key: input.photoKey ?? null,
    photo_status: photoStatus,
    hidden: 0,
    created_at: input.now,
  }
}

function guestbookEntryInsertStatement(env: Pick<GuestbookEnv, 'DB'>, entry: GuestbookEntryRecord): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO guestbook_entries
      (id, nickname, message, entry_emoji, photo_key, photo_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    entry.id,
    entry.nickname,
    entry.message,
    entry.entry_emoji,
    entry.photo_key,
    entry.photo_status,
    entry.created_at,
  )
}

export async function createGuestbookEntry(
  env: Pick<GuestbookEnv, 'DB'>,
  input: NewGuestbookEntry,
): Promise<GuestbookEntryRecord> {
  const entry = buildGuestbookEntry(input)
  await guestbookEntryInsertStatement(env, entry).run()

  return entry
}

export async function createPhotoCleanupIntent(
  env: Pick<GuestbookEnv, 'DB'>,
  photoKey: string,
  now: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO guestbook_photo_cleanup (photo_key, created_at)
     VALUES (?, ?)
     ON CONFLICT(photo_key) DO NOTHING`,
  ).bind(photoKey, now).run()
}

export async function clearPhotoCleanupIntent(
  env: Pick<GuestbookEnv, 'DB'>,
  photoKey: string,
): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?',
  ).bind(photoKey).run()
}

/**
 * D1 executes a batch atomically, so a cleanup intent is cleared only in the
 * same committed transaction that makes its pending image reference durable.
 */
export async function createGuestbookPhotoEntry(
  env: Pick<GuestbookEnv, 'DB'>,
  input: NewGuestbookEntry & { photoKey: string },
): Promise<GuestbookEntryRecord> {
  const entry = buildGuestbookEntry(input)
  await env.DB.batch([
    guestbookEntryInsertStatement(env, entry),
    env.DB.prepare('DELETE FROM guestbook_photo_cleanup WHERE photo_key = ?').bind(input.photoKey),
  ])

  return entry
}

export async function setGuestbookReaction(
  env: Pick<GuestbookEnv, 'DB'>,
  input: SetGuestbookReactionInput,
): Promise<{ active: boolean; total: number }> {
  const entryCheck = env.DB.prepare(
    'SELECT id FROM guestbook_entries WHERE id = ? AND hidden = 0',
  ).bind(input.entryId)
  const mutation = input.active
    ? env.DB.prepare(
      `INSERT INTO guestbook_reactions (entry_id, visitor_hash, emoji, created_at)
       SELECT ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM guestbook_entries WHERE id = ? AND hidden = 0
       )
       ON CONFLICT(entry_id, visitor_hash, emoji) DO NOTHING`,
    ).bind(input.entryId, input.visitorHash, input.emoji, input.now, input.entryId)
    : env.DB.prepare(
      `DELETE FROM guestbook_reactions
       WHERE entry_id = ? AND visitor_hash = ? AND emoji = ?
       AND EXISTS (
         SELECT 1 FROM guestbook_entries WHERE id = ? AND hidden = 0
       )`,
    ).bind(input.entryId, input.visitorHash, input.emoji, input.entryId)
  const totalQuery = env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM guestbook_reactions
     WHERE entry_id = ? AND emoji = ?`,
  ).bind(input.entryId, input.emoji)
  const [entryResult, , totalResult] = await env.DB.batch([
    entryCheck,
    mutation,
    totalQuery,
  ])

  if ((entryResult.results ?? []).length === 0) {
    throw new GuestbookNotFoundError()
  }

  const totalRow = (totalResult.results?.[0] ?? null) as CountRow | null

  return { active: input.active, total: countFromRow(totalRow) }
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface TurnstileVerificationOptions {
  expectedHostname?: string
  expectedAction?: string
  fetchImplementation?: FetchImplementation
}

/**
 * Verifies a Turnstile token without forwarding or recording an IP address.
 */
export async function verifyTurnstile(
  token: unknown,
  secret: string,
  configuration: TurnstileVerificationOptions | FetchImplementation = {},
): Promise<void> {
  if (typeof token !== 'string' || token.trim() === '' || secret.trim() === '') {
    throw new GuestbookTurnstileError()
  }

  const options = typeof configuration === 'function'
    ? { fetchImplementation: configuration }
    : configuration
  const expectedHostname = options.expectedHostname ?? 'nanamicat.com'
  const fetchImplementation = options.fetchImplementation ?? fetch

  let response: Response
  try {
    response = await fetchImplementation('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
  } catch {
    throw new GuestbookTurnstileError()
  }

  if (!response.ok) {
    throw new GuestbookTurnstileError()
  }

  try {
    const payload: unknown = await response.json()
    if (
      typeof payload !== 'object'
      || payload === null
      || !('success' in payload)
      || !('hostname' in payload)
      || payload.success !== true
      || payload.hostname !== expectedHostname
      || (options.expectedAction !== undefined && (!('action' in payload) || payload.action !== options.expectedAction))
    ) {
      throw new GuestbookTurnstileError()
    }
  } catch (error) {
    if (error instanceof GuestbookTurnstileError) {
      throw error
    }

    throw new GuestbookTurnstileError()
  }
}

/**
 * Verifies a Turnstile token without forwarding or recording an IP address.
 */
