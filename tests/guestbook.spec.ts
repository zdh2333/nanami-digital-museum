import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const TEST_TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const fixturePrefix = `e2e${Date.now()}`
const localState = '.wrangler/state-e2e'

function wrangler(...args: string[]) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  })
}

function seedGuestbookEntries(rows: Array<{
  id: string
  nickname: string
  message: string
  photoKey?: string
  photoStatus?: 'none' | 'pending' | 'approved'
  createdAt: number
}>) {
  const values = rows.map((row) => {
    const photoKey = row.photoKey === undefined ? 'NULL' : `'${row.photoKey}'`
    const photoStatus = row.photoStatus ?? 'none'
    return `('${row.id}', '${row.nickname}', '${row.message}', '🐾', ${photoKey}, '${photoStatus}', ${row.createdAt})`
  }).join(', ')
  wrangler(
    'd1', 'execute', 'nanami-guestbook', '--local', '--persist-to', localState,
    '--command', `INSERT INTO guestbook_entries (id, nickname, message, entry_emoji, photo_key, photo_status, created_at) VALUES ${values};`,
  )
}

async function createTextEntry(request: APIRequestContext, input: {
  ip: string
  nickname?: string
  message?: string
  emoji?: string
}) {
  return request.post('/api/guestbook', {
    headers: { 'cf-connecting-ip': input.ip },
    multipart: {
      nickname: input.nickname ?? 'Momo',
      message: input.message ?? 'Hello Nanami',
      emoji: input.emoji ?? '🐾',
      'cf-turnstile-response': TEST_TURNSTILE_TOKEN,
    },
  })
}

async function mockTurnstile(page: Page) {
  await page.route(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        (() => {
          let callback;
          window.turnstile = {
            render(_container, options) {
              callback = options.callback;
              queueMicrotask(() => callback('XXXX.DUMMY.TOKEN.XXXX'));
              return 'local-test-turnstile';
            },
            reset() { queueMicrotask(() => callback?.('XXXX.DUMMY.TOKEN.XXXX')); },
            remove() {},
          };
        })();
      `,
    })
  })
}

async function mockTurnstileError(page: Page) {
  await page.route(/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render(_container, options) {
            queueMicrotask(() => options['error-callback']());
            return 'local-test-turnstile-error';
          },
          reset() {},
          remove() {},
        };
      `,
    })
  })
}

function collectPageFailures(page: Page) {
  const failures: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`))
  page.on('requestfailed', (request) => failures.push(`request: ${request.url()} (${request.failure()?.errorText})`))
  page.on('response', (response) => {
    if (response.url().includes('/api/guestbook') && response.status() >= 400) {
      failures.push(`response: ${response.status()} ${response.url()}`)
    }
  })
  return failures
}

test.describe('local Cloudflare Pages guestbook integration', () => {
  test.skip(process.env.E2E_LOCAL_PAGES !== '1', 'requires npm run test:e2e:pages')

  test.beforeAll(() => {
    // Only clears the isolated local D1 state used by `dev:pages`; never a remote database.
    wrangler(
      'd1', 'execute', 'nanami-guestbook', '--local', '--persist-to', localState,
      '--command', 'DELETE FROM guestbook_reactions; DELETE FROM guestbook_rate_events; DELETE FROM guestbook_photo_cleanup; DELETE FROM guestbook_entries;',
    )
  })

  test('serves safe reads and rejects malformed writes', async ({ request }) => {
    const list = await request.get('/api/guestbook')
    expect(list.status()).toBe(200)
    expect(list.headers()['cache-control']).toBe('no-store')
    const listPayload = await list.json() as { entries: unknown; nextCursor: unknown }
    expect(listPayload.entries).toEqual(expect.any(Array))
    expect(listPayload.nextCursor === null || typeof listPayload.nextCursor === 'string').toBe(true)

    const invalid = await request.post('/api/guestbook', { data: {} })
    expect(invalid.status()).toBe(400)
    await expect(invalid.json()).resolves.toEqual({ error: 'Guestbook submissions must use form data' })

  })

  test('fails safely when the local Pages sanitizer service is not connected', async ({ request }) => {
    const response = await request.post('/api/guestbook', {
      headers: { 'cf-connecting-ip': '203.0.113.92' },
      multipart: {
        nickname: 'Photo service test',
        message: 'Local sanitizer failure must not publish a photo.',
        emoji: '🐾',
        'cf-turnstile-response': TEST_TURNSTILE_TOKEN,
        photo: {
          name: 'nanami-photo-017-640.webp',
          mimeType: 'image/webp',
          buffer: readFileSync('public/archive/photos/nanami-photo-017-640.webp'),
        },
      },
    })
    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Cat photo could not be processed' })
  })

  test('uses explicit reaction desired-state with the signed visitor cookie', async ({ request }) => {
    const created = await createTextEntry(request, {
      ip: '203.0.113.89',
      nickname: 'Reaction Momo',
      message: 'One reaction, then remove it.',
    })
    expect(created.status()).toBe(201)
    const entry = (await created.json()).entry as { id: string }
    const cookie = created.headers()['set-cookie']?.split(';', 1)[0]
    expect(cookie).toMatch(/^nanami_guestbook_visitor=/)

    const headers = { 'cf-connecting-ip': '203.0.113.89', cookie: cookie! }
    const add = await request.post(`/api/guestbook/${entry.id}/reactions`, {
      headers,
      data: { emoji: '🖤', active: true, 'cf-turnstile-response': TEST_TURNSTILE_TOKEN },
    })
    expect(add.status()).toBe(200)
    await expect(add.json()).resolves.toMatchObject({ entryId: entry.id, emoji: '🖤', active: true, total: 1 })

    const remove = await request.post(`/api/guestbook/${entry.id}/reactions`, {
      headers,
      data: { emoji: '🖤', active: false, 'cf-turnstile-response': TEST_TURNSTILE_TOKEN },
    })
    expect(remove.status()).toBe(200)
    await expect(remove.json()).resolves.toMatchObject({ entryId: entry.id, emoji: '🖤', active: false, total: 0 })
  })

  test('keeps pending photos private, delivers approved R2 photos, and paginates local D1 rows', async ({ request }) => {
    const pendingId = `${fixturePrefix}pending`
    const approvedId = `${fixturePrefix}approved`
    const approvedKey = `approved/${approvedId}.webp`
    const pageRows = Array.from({ length: 13 }, (_, index) => ({
      id: `${fixturePrefix}page${String(index).padStart(2, '0')}`,
      nickname: `Page ${index}`,
      message: `Pagination fixture ${index}`,
      createdAt: 1_900_000_000_000 + index,
    }))
    seedGuestbookEntries([
      { id: pendingId, nickname: 'Pending Photo', message: 'This photo remains private.', photoKey: `pending/${pendingId}.webp`, photoStatus: 'pending', createdAt: 1_900_000_000_100 },
      { id: approvedId, nickname: 'Approved Photo', message: 'This photo may be delivered.', photoKey: approvedKey, photoStatus: 'approved', createdAt: 1_900_000_000_101 },
      ...pageRows,
    ])
    wrangler(
      'r2', 'object', 'put', `nanami-guestbook-photos/${approvedKey}`, '--local',
      '--persist-to', localState, '--content-type', 'image/webp',
      '--file', 'public/archive/photos/nanami-photo-017-640.webp',
    )

    const firstPage = await request.get('/api/guestbook')
    expect(firstPage.status()).toBe(200)
    const payload = await firstPage.json() as {
      entries: Array<{ id: string; photoUrl: string | null }>
      nextCursor: string | null
    }
    expect(payload.entries).toHaveLength(12)
    expect(payload.nextCursor).not.toBeNull()
    expect(payload.entries.find((entry) => entry.id === pendingId)?.photoUrl).toBeNull()
    expect(payload.entries.find((entry) => entry.id === approvedId)?.photoUrl)
      .toBe(`/api/guestbook/photos/${approvedId}`)

    const pendingPhoto = await request.get(`/api/guestbook/photos/${pendingId}`)
    expect(pendingPhoto.status()).toBe(404)
    const approvedPhoto = await request.get(`/api/guestbook/photos/${approvedId}`)
    expect(approvedPhoto.status()).toBe(200)
    expect(approvedPhoto.headers()['content-type']).toBe('image/webp')

    const secondPage = await request.get(`/api/guestbook?cursor=${encodeURIComponent(payload.nextCursor!)}`)
    expect(secondPage.status()).toBe(200)
    expect((await secondPage.json()).entries).not.toEqual([])
  })

  test('submits a text pawprint through the rendered Pages form without runtime failures', async ({ page }, testInfo) => {
    const failures = collectPageFailures(page)
    await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '203.0.113.90' })
    await mockTurnstile(page)
    await page.goto('/#guestbook')
    await page.getByLabel('Nickname').fill('Browser Momo')
    await page.getByLabel('Message').fill('Hello from the local Pages form.')
    await page.getByRole('button', { name: '🐾', exact: true }).click()
    await expect(page.getByLabel('Turnstile verification')).toBeAttached()
    await page.getByRole('button', { name: 'Leave a pawprint' }).click()

    await expect(page.getByText('Your pawprint is now in the guestbook.')).toBeVisible()
    await expect(page.getByText('Browser Momo', { exact: true })).toBeVisible()
    await expect(page.getByText('Hello from the local Pages form.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '🐾', exact: true })).toHaveAttribute('aria-pressed', 'false')

    await page.locator('#guestbook-nickname').focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Message')).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('guestbook-pages-desktop.png'), animations: 'disabled' })
    expect(failures).toEqual([])
  })

  test('keeps a rejected local photo draft intact and exposes an accessible verification failure state', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.setExtraHTTPHeaders({ 'cf-connecting-ip': '203.0.113.91' })
    await mockTurnstileError(page)
    await page.goto('/#guestbook')
    await page.getByLabel('Nickname').fill('Photo Momo')
    await page.getByLabel('Message').fill('This draft should remain after a failed verification.')
    await page.setInputFiles('#guestbook-photo', 'public/archive/photos/nanami-photo-017-640.webp')
    await expect(page.getByText('nanami-photo-017-640.webp', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Leave a pawprint' }).click()
    await expect(page.getByText('Complete verification before posting.')).toBeVisible()
    await expect(page.getByText('nanami-photo-017-640.webp', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('enforces the local Pages entry rate limit after the prior three guarded writes', async ({ request }) => {
    // Wrangler Pages dev supplies a local CF-Connecting-IP for every request.
    // The production-only missing/invalid-header branch is covered in unit tests;
    // this proves the actual local Function enforces its D1-backed rate bucket.
    const ip = '203.0.113.99'
    for (let index = 0; index < 3; index += 1) {
      const accepted = await createTextEntry(request, {
        ip,
        nickname: `Rate ${index}`,
        message: `Rate limit entry ${index}`,
      })
      expect(accepted.status()).toBe(201)
    }
    const limited = await createTextEntry(request, { ip, nickname: 'Rate four', message: 'This fourth writer action must be rate limited.' })
    expect(limited.status()).toBe(429)
  })
})
