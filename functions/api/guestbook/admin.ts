/**
 * The former password-backed moderation endpoint is intentionally retired.
 * Return a real API 404 instead of allowing Pages' SPA fallback to serve HTML.
 */
export const onRequest: PagesFunction = async () => Response.json(
  { error: 'Not found' },
  { status: 404, headers: { 'cache-control': 'no-store' } },
)
