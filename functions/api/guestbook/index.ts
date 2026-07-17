import {
  createGuestbookEntry,
  enforceRateLimit,
  getVisitor,
  listPublicGuestbookEntries,
  serializePublicEntry,
  verifyTurnstile,
  type GuestbookEnv,
  type GuestbookVisitor,
} from '../../_lib/guestbook'
import { guestbookError, guestbookJson, getTurnstileToken, turnstileOptions } from '../../_lib/http'
import { guestbookLimits } from '../../../src/guestbook/contracts'
import { GuestbookValidationError, parseEntryFields, validatePhoto } from '../../../src/guestbook/validation'

const MAX_SANITIZED_PHOTO_BYTES = 5 * 1024 * 1024

function optionalPhoto(value: FormDataEntryValue | null): File | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    if (value === '') {
      return null
    }
    throw new GuestbookValidationError('Photo must be a file')
  }

  if (
    typeof value !== 'object'
    || typeof value.name !== 'string'
    || typeof value.type !== 'string'
    || typeof value.size !== 'number'
    || typeof value.arrayBuffer !== 'function'
  ) {
    throw new GuestbookValidationError('Photo must be a file')
  }

  if (value.name === '' && value.size === 0) {
    return null
  }

  return value
}

async function parseEntryRequest(request: Request): Promise<{
  fields: ReturnType<typeof parseEntryFields>
  photo: File | null
  turnstileToken: unknown
}> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new GuestbookValidationError('Guestbook submissions must use form data')
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new GuestbookValidationError('Guestbook form data is invalid')
  }

  return {
    fields: parseEntryFields({
      nickname: form.get('nickname'),
      message: form.get('message'),
      emoji: form.get('emoji'),
    }),
    photo: optionalPhoto(form.get('photo')),
    turnstileToken: getTurnstileToken({
      'cf-turnstile-response': form.get('cf-turnstile-response'),
      turnstileToken: form.get('turnstileToken'),
    }),
  }
}

interface PreparedPhoto {
  declaredMime: string
  bytes: ArrayBuffer
}

async function preparePhoto(photo: File): Promise<PreparedPhoto> {
  if (photo.size > guestbookLimits.photoMaxBytes) {
    throw new GuestbookValidationError('Photo exceeds the 5 MiB limit')
  }

  const bytes = await photo.arrayBuffer()
  validatePhoto({ declaredMime: photo.type, bytes: new Uint8Array(bytes), size: photo.size })

  return { declaredMime: photo.type, bytes }
}

async function sanitizeAndStorePhoto(
  env: GuestbookEnv,
  photo: PreparedPhoto,
): Promise<string> {
  let transformed: Response
  try {
    transformed = await env.IMAGE_SANITIZER.fetch(new Request('https://nanami-internal/sanitize', {
      method: 'POST',
      headers: {
        'x-nanami-internal': 'pages',
        'content-type': photo.declaredMime,
      },
      body: photo.bytes,
    }))
  } catch {
    throw new GuestbookValidationError('Cat photo could not be processed')
  }

  if (transformed.status !== 200 || transformed.headers.get('content-type')?.toLowerCase() !== 'image/webp') {
    throw new GuestbookValidationError('Cat photo could not be processed')
  }

  const sanitizedBytes = await transformed.arrayBuffer()
  if (sanitizedBytes.byteLength === 0 || sanitizedBytes.byteLength > MAX_SANITIZED_PHOTO_BYTES) {
    throw new GuestbookValidationError('Cat photo could not be processed')
  }

  const photoKey = `pending/${crypto.randomUUID()}.webp`
  await env.PHOTOS.put(photoKey, sanitizedBytes, {
    httpMetadata: {
      contentType: 'image/webp',
      cacheControl: 'private, no-store',
    },
  })

  return photoKey
}

export const onRequestGet: PagesFunction<GuestbookEnv> = async (context) => {
  try {
    const cursor = new URL(context.request.url).searchParams.get('cursor')
    return guestbookJson(await listPublicGuestbookEntries(context.env, cursor), 200)
  } catch (error) {
    return guestbookError(error)
  }
}

export const onRequestPost: PagesFunction<GuestbookEnv> = async (context) => {
  let visitor: GuestbookVisitor | undefined
  let storedPhotoKey: string | undefined

  try {
    const submission = await parseEntryRequest(context.request)
    const preparedPhoto = submission.photo === null ? null : await preparePhoto(submission.photo)
    await verifyTurnstile(
      submission.turnstileToken,
      context.env.TURNSTILE_SECRET_KEY,
      turnstileOptions(context.env),
    )

    visitor = await getVisitor(context.request, context.env.GUESTBOOK_HMAC_KEY)
    await enforceRateLimit(context.env, {
      fingerprintHash: visitor.visitorHash,
      action: 'entry',
      now: Date.now(),
    })

    storedPhotoKey = preparedPhoto === null
      ? undefined
      : await sanitizeAndStorePhoto(context.env, preparedPhoto)
    const entry = await createGuestbookEntry(context.env, {
      id: crypto.randomUUID(),
      nickname: submission.fields.nickname,
      message: submission.fields.message,
      emoji: submission.fields.emoji,
      photoKey: storedPhotoKey,
      photoStatus: storedPhotoKey === undefined ? 'none' : 'pending',
      now: Date.now(),
    })
    const publicEntry = serializePublicEntry(entry, [])

    return guestbookJson({
      entry: publicEntry,
      photoStatus: entry.photo_status,
      photoUrl: publicEntry.photoUrl,
    }, 201, visitor)
  } catch (error) {
    if (storedPhotoKey !== undefined) {
      try {
        await context.env.PHOTOS.delete(storedPhotoKey)
      } catch {
        // The object remains private and cannot be served while its D1 row is absent.
      }
    }
    return guestbookError(error, visitor)
  }
}
