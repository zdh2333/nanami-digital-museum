import { guestbookLimits } from '../../../src/guestbook/contracts'

export const RATE_LIMIT_WINDOW_MS = guestbookLimits.rateWindowMs

export interface GuestbookCleanerEnv {
  DB: D1Database
}

export async function cleanupRateEvents(
  env: GuestbookCleanerEnv,
  scheduledTime: number,
): Promise<void> {
  await env.DB.prepare(
    'DELETE FROM guestbook_rate_events WHERE created_at < ?',
  ).bind(scheduledTime - RATE_LIMIT_WINDOW_MS).run()
}

export default {
  scheduled(controller, env, context) {
    context.waitUntil(cleanupRateEvents(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<GuestbookCleanerEnv>
