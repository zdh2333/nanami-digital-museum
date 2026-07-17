import {
  enforceRateLimit,
  getRateIdentity,
  getVisitor,
  setGuestbookReaction,
  verifyTurnstile,
  type GuestbookEnv,
  type GuestbookVisitor,
} from '../../../_lib/guestbook'
import {
  getTurnstileToken,
  guestbookError,
  guestbookJson,
  plainJsonRecord,
  turnstileOptions,
  validGuestbookEntryId,
} from '../../../_lib/http'
import { isReactionEmoji } from '../../../../src/guestbook/contracts'
import { GuestbookValidationError } from '../../../../src/guestbook/validation'

export const onRequestPost: PagesFunction<GuestbookEnv, 'id'> = async (context) => {
  let visitor: GuestbookVisitor | undefined

  try {
    const entryId = validGuestbookEntryId(context.params.id)
    const contentType = context.request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new GuestbookValidationError('Reactions must use JSON')
    }

    let payload: Record<string, unknown>
    try {
      payload = plainJsonRecord(await context.request.json())
    } catch (error) {
      if (error instanceof GuestbookValidationError) {
        throw error
      }
      throw new GuestbookValidationError('Reaction JSON is invalid')
    }

    if (typeof payload.emoji !== 'string' || !isReactionEmoji(payload.emoji)) {
      throw new GuestbookValidationError('Reaction emoji is not allowed')
    }
    if (typeof payload.active !== 'boolean') {
      throw new GuestbookValidationError('Reaction state is required')
    }

    const rateIdentity = await getRateIdentity(context.request, context.env.GUESTBOOK_HMAC_KEY)

    await verifyTurnstile(
      getTurnstileToken(payload),
      context.env.TURNSTILE_SECRET_KEY,
      turnstileOptions(context.env),
    )
    visitor = await getVisitor(context.request, context.env.GUESTBOOK_HMAC_KEY)
    await enforceRateLimit(context.env, {
      fingerprintHash: visitor.visitorHash,
      action: 'reaction',
      now: Date.now(),
    })
    await enforceRateLimit(context.env, {
      fingerprintHash: rateIdentity,
      action: 'reaction',
      now: Date.now(),
    })
    const reaction = await setGuestbookReaction(context.env, {
      entryId,
      visitorHash: visitor.visitorHash,
      emoji: payload.emoji,
      active: payload.active,
      now: Date.now(),
    })

    return guestbookJson({ entryId, emoji: payload.emoji, ...reaction }, 200, visitor)
  } catch (error) {
    return guestbookError(error, visitor)
  }
}
