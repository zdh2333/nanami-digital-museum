import {
  GuestbookCursorError,
  GuestbookNotFoundError,
  GuestbookRateIdentityError,
  GuestbookRateLimitError,
  type GuestbookVisitor,
} from './guestbook'
import { GuestbookValidationError } from '../../src/guestbook/validation'

export function guestbookJson(body: unknown, status: number, visitor?: GuestbookVisitor): Response {
  const headers = new Headers({ 'cache-control': 'no-store' })
  if (visitor?.setCookie !== undefined) {
    headers.append('set-cookie', visitor.setCookie)
  }

  return Response.json(body, { status, headers })
}

export function guestbookError(error: unknown, visitor?: GuestbookVisitor): Response {
  if (error instanceof GuestbookValidationError || error instanceof GuestbookCursorError) {
    return guestbookJson({ error: error.message }, 400, visitor)
  }

  if (error instanceof GuestbookRateLimitError) {
    return guestbookJson({ error: error.message }, 429, visitor)
  }

  if (error instanceof GuestbookRateIdentityError) {
    return guestbookJson({ error: 'Guestbook write protection is unavailable. Please try again later.' }, 503, visitor)
  }

  if (error instanceof GuestbookNotFoundError) {
    return guestbookJson({ error: 'Guestbook entry not found' }, 404, visitor)
  }

  return guestbookJson({ error: 'Guestbook is temporarily unavailable. Please try again later.' }, 500, visitor)
}

export function plainJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GuestbookValidationError('Request body must be a JSON object')
  }

  return value as Record<string, unknown>
}

export function validGuestbookEntryId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new GuestbookValidationError('Guestbook entry ID is invalid')
  }

  return value
}
