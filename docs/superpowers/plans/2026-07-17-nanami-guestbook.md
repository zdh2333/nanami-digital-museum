# Nanami Guestbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bilingual, photo-safe Nanami guestbook with immediate text/emoji posts, moderated cat-photo submissions, and controlled Cloudflare deployment.

**Architecture:** React renders a real-photo guestbook chapter between Living Archive and Closing. Cloudflare Pages Functions expose the public API backed by D1 and private R2. A route-less `nanami-image-sanitizer` Worker, reached only through a Service Binding, re-encodes uploads into metadata-free WebP before R2 storage.

**Tech Stack:** React 18, TypeScript, Vitest, Playwright, Cloudflare Pages Functions, D1, R2, Workers Images binding, Turnstile, Wrangler 4.112.0, `@cloudflare/workers-types` 5.20260717.1.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `src/guestbook/contracts.ts` | Shared API types, emoji allow-list, limits, and pure data helpers. |
| `src/guestbook/validation.ts` | Plain-text, upload, cursor, and response validation. |
| `src/guestbook/client.ts` | Browser fetch, pagination, and typed errors. |
| `src/components/Guestbook.tsx` | Localized form, photo preview, entries, reactions, and status. |
| `src/components/TurnstileWidget.tsx` | Official Turnstile script lifecycle and one current token. |
| `functions/_lib/guestbook.ts` | Pages-side HMAC cookies, D1 queries, rate checks, and response shaping. |
| `functions/api/guestbook/` | List/create/reaction/photo Pages Function routes. |
| `migrations/0001_guestbook.sql` | D1 tables, indices, and constraints. |
| `workers/nanami-image-sanitizer/` | Private image transformation Worker. |
| `wrangler.toml` | Downloaded-and-reviewed Pages config with D1/R2/Service bindings. |
| `docs/guestbook-moderation.md` | Owner approval/rejection/hide/delete instructions. |

### Task 1: Install tooling and shared contract

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `tsconfig.functions.json`, `src/guestbook/contracts.ts`, `src/guestbook/contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest'
import { ENTRY_EMOJIS, REACTION_EMOJIS, guestbookLimits, isReactionEmoji } from './contracts'

describe('guestbook contracts', () => {
  it('allows only approved emoji and fixed limits', () => {
    expect(ENTRY_EMOJIS).toEqual(['🐈‍⬛', '🖤', '🐾', '😺', '✨'])
    expect(REACTION_EMOJIS).toEqual(ENTRY_EMOJIS)
    expect(guestbookLimits).toMatchObject({ nicknameMax: 24, messageMax: 500, photoMaxBytes: 5 * 1024 * 1024 })
    expect(isReactionEmoji('🐾')).toBe(true)
    expect(isReactionEmoji('🔥')).toBe(false)
  })
})
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/guestbook/contracts.test.ts`  
Expected: FAIL because `contracts.ts` is absent.

- [ ] **Step 3: Install tools and add minimal contract**

Run:

```bash
npm install --save-dev wrangler@4.112.0 @cloudflare/workers-types@5.20260717.1
```

Create `src/guestbook/contracts.ts`:

```ts
export const ENTRY_EMOJIS = ['🐈‍⬛', '🖤', '🐾', '😺', '✨'] as const
export const REACTION_EMOJIS = ENTRY_EMOJIS
export type GuestbookEmoji = (typeof ENTRY_EMOJIS)[number]
export const guestbookLimits = {
  nicknameMin: 1, nicknameMax: 24, messageMin: 1, messageMax: 500,
  photoMaxBytes: 5 * 1024 * 1024, pageSize: 12,
  entryLimit: 3, reactionLimit: 24, rateWindowMs: 10 * 60 * 1000,
} as const
export function isReactionEmoji(value: string): value is GuestbookEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value)
}
```

Create `tsconfig.functions.json`:

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": { "types": ["@cloudflare/workers-types"] },
  "include": ["functions", "workers"]
}
```

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- src/guestbook/contracts.test.ts && npx tsc -p tsconfig.functions.json --noEmit`  
Expected: PASS.

```bash
git add package.json package-lock.json tsconfig.functions.json src/guestbook/contracts.ts src/guestbook/contracts.test.ts
git commit -m "chore: add Nanami guestbook platform types"
```

### Task 2: Implement fail-closed submission validation

**Files:**
- Create: `src/guestbook/validation.ts`, `src/guestbook/validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
it('normalizes plain text and rejects markup, empty text, and overlong fields', () => {
  expect(parseEntryFields({ nickname: '  N\u0061nami  ', message: '  hello 🐾  ', emoji: '🐾' }))
    .toEqual({ nickname: 'Nanami', message: 'hello 🐾', emoji: '🐾' })
  expect(() => parseEntryFields({ nickname: '<b>x</b>', message: 'hello', emoji: '🐾' })).toThrow('Nickname contains markup')
  expect(() => parseEntryFields({ nickname: 'x', message: '', emoji: '' })).toThrow('Message is required')
})

it('accepts JPEG, PNG, and WebP signatures only', () => {
  expect(validatePhotoSignature(new Uint8Array([0xff, 0xd8, 0xff]))).toBe('image/jpeg')
  expect(validatePhotoSignature(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull()
})
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/guestbook/validation.test.ts`  
Expected: FAIL because validation exports are absent.

- [ ] **Step 3: Implement validation**

Implement `parseEntryFields` to NFC-normalize, trim, reject angle-bracket markup, enforce the shared limits, and permit only an empty string or `GuestbookEmoji`. Implement `validatePhotoSignature` for JPEG (`ff d8 ff`), PNG (`89 50 4e 47 0d 0a 1a 0a`), and RIFF/WEBP (`RIFF....WEBP`); return `null` for every other source.

- [ ] **Step 4: Verify boundaries and commit**

Add cases for 24/25-character names, 500/501-character messages, all approved emoji, GIF, SVG, AVIF, and mismatched declared MIME. Run: `npm test -- src/guestbook/validation.test.ts`  
Expected: PASS.

```bash
git add src/guestbook/validation.ts src/guestbook/validation.test.ts
git commit -m "feat: validate guestbook submissions fail closed"
```

### Task 3: Add private image sanitizer Worker

**Files:**
- Create: `workers/nanami-image-sanitizer/src/index.ts`
- Create: `workers/nanami-image-sanitizer/src/index.test.ts`
- Create: `workers/nanami-image-sanitizer/wrangler.toml`

- [ ] **Step 1: Write the failing sanitizer test**

```ts
it('requests WebP output with metadata disabled and a 1600px maximum edge', async () => {
  await sanitizeImage(fakeImageBytes, fakeImagesBinding)
  expect(fakeImagesBinding.calls).toEqual([
    ['input', fakeImageBytes],
    ['transform', { width: 1600, height: 1600, fit: 'scale-down', metadata: 'none' }],
    ['output', { format: 'image/webp', quality: 82 }],
  ])
})
```

- [ ] **Step 2: Verify red**

Run: `npm test -- workers/nanami-image-sanitizer/src/index.test.ts`  
Expected: FAIL because `sanitizeImage` is absent.

- [ ] **Step 3: Implement the route-less sanitizer**

```ts
export interface SanitizerEnv { IMAGES: ImagesBinding }
export async function sanitizeImage(bytes: ArrayBuffer, images: ImagesBinding) {
  const output = await images.input(bytes)
    .transform({ width: 1600, height: 1600, fit: 'scale-down', metadata: 'none' })
    .output({ format: 'image/webp', quality: 82 })
    .response()
  return new Response(output.body, { headers: { 'content-type': 'image/webp' } })
}
export default {
  async fetch(request, env) {
    if (request.method !== 'POST' || request.headers.get('x-nanami-internal') !== 'pages') return new Response('Not found', { status: 404 })
    return sanitizeImage(await request.arrayBuffer(), env.IMAGES)
  },
} satisfies ExportedHandler<SanitizerEnv>
```

Use `name = "nanami-image-sanitizer"`, a current compatibility date, and `[images] binding = "IMAGES"` in its Wrangler file. Do not configure a route.

- [ ] **Step 4: Verify malformed image failure and commit**

Add a malformed-source test returning 415. Run: `npm test -- workers/nanami-image-sanitizer/src/index.test.ts && npx tsc -p tsconfig.functions.json --noEmit`  
Expected: PASS.

```bash
git add workers/nanami-image-sanitizer tsconfig.functions.json
git commit -m "feat: add private Nanami image sanitizer"
```

### Task 4: Create D1 model and server helpers

**Files:**
- Create: `migrations/0001_guestbook.sql`
- Create: `functions/_lib/guestbook.ts`, `functions/_lib/guestbook.test.ts`

- [ ] **Step 1: Write the failing public-serialization test**

```ts
it('does not serialize pending photos and counts only permitted reactions', async () => {
  const entry = serializePublicEntry(
    { id: 'e1', photo_status: 'pending', photo_key: 'pending/e1.webp', hidden: 0 },
    [{ emoji: '🐾', total: 2 }, { emoji: '🔥', total: 99 }],
  )
  expect(entry.photoUrl).toBeNull()
  expect(entry.reactions).toEqual([{ emoji: '🐾', total: 2 }])
})
```

- [ ] **Step 2: Verify red**

Run: `npm test -- functions/_lib/guestbook.test.ts`  
Expected: FAIL because the server helper is absent.

- [ ] **Step 3: Add schema and helpers**

Create `migrations/0001_guestbook.sql`:

```sql
CREATE TABLE guestbook_entries (
  id TEXT PRIMARY KEY, nickname TEXT NOT NULL, message TEXT NOT NULL,
  entry_emoji TEXT, photo_key TEXT,
  photo_status TEXT NOT NULL DEFAULT 'none' CHECK (photo_status IN ('none','pending','approved','rejected')),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)), created_at INTEGER NOT NULL
);
CREATE INDEX guestbook_entries_public_cursor ON guestbook_entries(hidden, created_at DESC, id DESC);
CREATE TABLE guestbook_reactions (
  entry_id TEXT NOT NULL REFERENCES guestbook_entries(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL, emoji TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY (entry_id, visitor_hash, emoji)
);
CREATE TABLE guestbook_rate_events (
  fingerprint_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('entry','reaction')),
  created_at INTEGER NOT NULL
);
CREATE INDEX guestbook_rate_events_window ON guestbook_rate_events(fingerprint_hash, action, created_at);
```

Define `GuestbookEnv` with `DB`, `PHOTOS`, `IMAGE_SANITIZER`, `TURNSTILE_SECRET_KEY`, and `GUESTBOOK_HMAC_KEY`. Implement `getVisitor`, `enforceRateLimit`, `verifyTurnstile`, `publicPhotoUrl`, and `serializePublicEntry`. Use Web Crypto HMAC-SHA-256 for signed `HttpOnly; Secure; SameSite=Lax` cookies and stored hashes. `publicPhotoUrl` returns `/api/guestbook/photos/${id}` only for approved, non-hidden entries.

- [ ] **Step 4: Verify limits and commit**

Add tests for signed cookies, three entries/24 reactions in ten minutes, allowed reaction totals, and each non-public status. Run: `npm test -- functions/_lib/guestbook.test.ts`  
Expected: PASS.

```bash
git add migrations/0001_guestbook.sql functions/_lib/guestbook.ts functions/_lib/guestbook.test.ts
git commit -m "feat: add guestbook persistence model"
```

### Task 5: Implement guarded Pages Function routes

**Files:**
- Create: `functions/api/guestbook/index.ts`
- Create: `functions/api/guestbook/[id]/reactions.ts`
- Create: `functions/api/guestbook/photos/[id].ts`
- Create: `functions/api/guestbook/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

```ts
it('publishes text while keeping the transformed upload pending', async () => {
  const response = await onRequestPost(fakePagesContext({
    nickname: 'Momo', message: 'Hello 🐾', emoji: '🐾', photo: catPhoto, turnstileToken: 'ok',
  }))
  expect(response.status).toBe(201)
  expect(fakeR2.put).toHaveBeenCalledWith(expect.stringMatching(/^pending\/.+\.webp$/), expect.any(ArrayBuffer), expect.anything())
  expect(await response.json()).toMatchObject({ photoStatus: 'pending', photoUrl: null })
})

it('returns 404 for pending images and WebP only for approved images', async () => {
  await expect(onRequestGet(fakePhotoContext('pending'))).resolves.toMatchObject({ status: 404 })
  await expect(onRequestGet(fakePhotoContext('approved'))).resolves.toMatchObject({ status: 200 })
})
```

- [ ] **Step 2: Verify red**

Run: `npm test -- functions/api/guestbook/routes.test.ts`  
Expected: FAIL because the routes are absent.

- [ ] **Step 3: Implement list/create route**

`GET` queries `hidden = 0`, uses a `(created_at,id)` cursor, returns up to 12 entries, aggregates allowed reactions, and sends `Cache-Control: no-store`.

`POST` reads `FormData`, validates with Task 2, requires `cf-turnstile-response`, verifies Siteverify, calls `getVisitor` and `enforceRateLimit`, then sanitizes an optional `File` with:

```ts
const transformed = await context.env.IMAGE_SANITIZER.fetch(new Request('https://nanami-internal/sanitize', {
  method: 'POST', headers: { 'x-nanami-internal': 'pages', 'content-type': photo.type }, body: photo.stream(),
}))
```

Reject non-200 sanitizer output. Store only the returned WebP under `pending/${crypto.randomUUID()}.webp`, write `photo_status = 'pending'`, and return text with `photoUrl: null`.

- [ ] **Step 4: Implement reaction/photo routes**

The reaction route requires an allowed emoji, Turnstile, and the reaction rate limit, then toggles the unique D1 row and returns updated permitted totals. The photo route selects `photo_key` only when `hidden = 0 AND photo_status = 'approved'`; otherwise return 404. Approved delivery uses `Content-Type: image/webp`, `X-Content-Type-Options: nosniff`, and `Cache-Control: public, max-age=86400`.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- functions/api/guestbook/routes.test.ts && npx tsc -p tsconfig.functions.json --noEmit`  
Expected: PASS for invalid Turnstile, malformed input, duplicate reactions, rate limits, hidden records, pending/rejected denial, and approved delivery.

```bash
git add functions/api/guestbook functions/_lib
git commit -m "feat: add guarded guestbook API routes"
```

### Task 6: Build localized real-photo Guestbook UI

**Files:**
- Create: `src/components/Guestbook.tsx`, `src/components/Guestbook.test.tsx`, `src/components/TurnstileWidget.tsx`
- Create: `src/guestbook/client.ts`, `src/guestbook/client.test.ts`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/i18n/copy.ts`, `src/components/navigationModel.ts`, `src/styles.css`

- [ ] **Step 1: Write failing component behavior test**

```tsx
it('submits a localized text entry, keeps its photo pending, and toggles a reaction', async () => {
  render(<LocaleProvider><Guestbook staticExperience={true} /></LocaleProvider>)
  await userEvent.type(screen.getByLabelText('Nickname'), 'Momo')
  await userEvent.type(screen.getByLabelText('Message'), 'Hello Nanami')
  await userEvent.click(screen.getByRole('button', { name: '🐾' }))
  await userEvent.click(screen.getByRole('button', { name: 'Leave a pawprint' }))
  expect(await screen.findByText('Hello Nanami')).toBeVisible()
  expect(screen.getByText('Photo pending review')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Add 🖤 reaction' }))
  expect(await screen.findByText('🖤 1')).toBeVisible()
})
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/components/Guestbook.test.tsx src/App.test.tsx`  
Expected: FAIL because the guestbook chapter is absent.

- [ ] **Step 3: Implement copy, client, and UI**

Add `guestbook` to `MuseumCopy['nav']` and `navigationItems` after Timeline with `href: '#guestbook'`. Add complete English/Chinese `copy.guestbook` labels, errors, empty state, dates, and reaction aria labels.

Implement typed `fetchGuestbook`, `createGuestbookEntry`, and `toggleReaction` in `client.ts`, throwing `GuestbookApiError` for API errors. `TurnstileWidget` dynamically appends only the official Turnstile script after the chapter mounts, exposes one current token, resets after every POST, and provides an accessible unavailable state; it never changes `index.html`.

`Guestbook` uses existing approved `archiveItems` photos for the large chapter visual and photo ribbon, has one real `<form>`, `<label>`s, `accept="image/jpeg,image/png,image/webp"`, one file only, 44px emoji/reaction targets, `aria-live="polite"`, pending-photo status, and escaped React text nodes. Insert it immediately before `<Closing />`.

Implement the confirmed style in `styles.css`: full-bleed real Nanami photo, high-legibility gradient, translucent rounded entry desk, offset paper-like entry cards, circular emoji stamps, and mobile single column. Do not add SVG decorations or generated cat photos.

- [ ] **Step 4: Verify green and commit**

Run: `npm test -- src/components/Guestbook.test.tsx src/guestbook/client.test.ts src/App.test.tsx`  
Expected: PASS for EN/ZH, pending privacy, draft retention after an error, 44px targets, dynamic script loading, and no pronoun/memorial regressions.

```bash
git add src/components/Guestbook.tsx src/components/Guestbook.test.tsx src/components/TurnstileWidget.tsx src/guestbook src/App.tsx src/App.test.tsx src/i18n/copy.ts src/components/navigationModel.ts src/styles.css
git commit -m "feat: add Nanami real-photo guestbook"
```

### Task 7: Provision Cloudflare resources and write moderation guide

**Files:**
- Create: `wrangler.toml` from downloaded Pages configuration
- Create: `docs/guestbook-moderation.md`
- Modify: `.gitignore`

- [ ] **Step 1: Authenticate and download current Pages configuration**

Run:

```bash
npx wrangler whoami
npx wrangler pages download config nanami-digital-museum
```

If authentication is unavailable, use the existing Cloudflare browser session and Google sign-in. Do not create a new account. Review the downloaded file before changing it.

- [ ] **Step 2: Create resources and apply migration**

Run:

```bash
npx wrangler d1 create nanami-guestbook
npx wrangler r2 bucket create nanami-guestbook-photos
npx wrangler d1 execute nanami-guestbook --remote --file=migrations/0001_guestbook.sql
```

Copy the returned D1 `database_id` into downloaded `wrangler.toml`. Add R2 binding `PHOTOS` and Pages Service Binding `IMAGE_SANITIZER` targeting `nanami-image-sanitizer`. Preserve all previously downloaded configuration.

- [ ] **Step 3: Deploy the private sanitizer and bind Turnstile**

Run:

```bash
npx wrangler deploy -c workers/nanami-image-sanitizer/wrangler.toml
```

If the Images binding is unavailable, enable Cloudflare Images Transformations for the existing account and retry; do not add a public Worker route.

In Cloudflare, create a Turnstile widget limited to `nanamicat.com` and the Pages preview hostname. Set `TURNSTILE_SITE_KEY` as a Pages variable and set secrets without printing values:

```bash
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name nanami-digital-museum
npx wrangler pages secret put GUESTBOOK_HMAC_KEY --project-name nanami-digital-museum
```

- [ ] **Step 4: Document owner moderation and commit**

Write `docs/guestbook-moderation.md` with these exact D1 actions:

```sql
SELECT id, nickname, message, photo_key, created_at FROM guestbook_entries
WHERE photo_status = 'pending' ORDER BY created_at DESC;
UPDATE guestbook_entries SET photo_status = 'approved' WHERE id = 'entry-id-after-visual-review';
UPDATE guestbook_entries SET hidden = 1 WHERE id = 'entry-id-to-hide';
DELETE FROM guestbook_entries WHERE id = 'entry-id-to-delete';
```

State that the owner must visually confirm cat-only/no-human-face before approval. A rejected image is deleted only after matching the exact `photo_key` from D1 in the R2 dashboard.

```bash
git add wrangler.toml docs/guestbook-moderation.md .gitignore
git commit -m "docs: configure Nanami guestbook operations"
```

### Task 8: Add local Pages integration and E2E coverage

**Files:**
- Modify: `playwright.config.ts`, `tests/museum.spec.ts`, `package.json`
- Create: `tests/guestbook.spec.ts`, `.dev.vars.example`

- [ ] **Step 1: Write a failing E2E privacy test**

```ts
test('keeps a submitted cat photo private until approval', async ({ page }) => {
  await page.goto('/#guestbook')
  await page.getByLabel('Nickname').fill('Momo')
  await page.getByLabel('Message').fill('Hello Nanami')
  await page.getByLabel('Cat photo').setInputFiles('public/archive/photos/nanami-photo-017-640.webp')
  await page.getByRole('button', { name: 'Leave a pawprint' }).click()
  await expect(page.getByText('Photo pending review')).toBeVisible()
  await expect(page.locator('[data-guestbook-photo="pending"]')).toHaveCount(0)
})
```

- [ ] **Step 2: Verify red**

Run: `npm run test:e2e -- tests/guestbook.spec.ts`
Expected: FAIL until local Pages Functions and the Guestbook UI run together.

- [ ] **Step 3: Add local Pages setup**

Add `dev:pages` as `npm run build && wrangler pages dev dist --port 4173`. Use the Task 7 bindings with local D1/R2 simulation and test-only Turnstile credentials. Add `.dev.vars.example` only:

```dotenv
TURNSTILE_SITE_KEY="1x00000000000000000000AA"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
GUESTBOOK_HMAC_KEY="replace-with-local-only-value"
```

Never create or commit `.dev.vars`.

- [ ] **Step 4: Cover the release behavior**

Add tests for EN/ZH, 1440×900/390×844/320×700, keyboard form order, unavailable Turnstile, 44px targets, text + selected emoji post, rejected upload, private pending image, approved local D1 fixture, reaction add/remove, pagination, preserved draft after error, mobile menu Guestbook navigation, reduced motion, no overflow, and no console/page/request failure.

Capture the Guestbook in the 36-screen museum matrix and inspect all images. Every decorative image must map to an existing approved Nanami asset with no human face.

- [ ] **Step 5: Run the full local gate and commit**

Run:

```bash
npm test
npm run archive:build
npm run share:build
npm run audit:assets
npm run build
npx tsc -p tsconfig.functions.json --noEmit
npm run test:e2e
rg -n -i '\\b(she|her|hers)\\b|她|memorial|deceased' src tests functions workers index.html public || true
find public dist -type f \( -iname '*.glb' -o -iname '*.gltf' \)
```

Expected: all checks pass; the pronoun scan has only test assertions; no GLB/GLTF exists.

```bash
git add playwright.config.ts tests/guestbook.spec.ts tests/museum.spec.ts package.json .dev.vars.example
git commit -m "test: cover Nanami guestbook release"
```

### Task 9: Push, deploy, and verify production

**Files:** No source changes expected.

- [ ] **Step 1: Run the release gate and inspect the branch**

Run Task 8’s full gate, `git diff --check`, `git status --short`, and manually inspect all final Guestbook/museum screenshots. Require a clean tree.

- [ ] **Step 2: Push the verified release to GitHub**

Run:

```bash
git push museum codex/nanami-museum
git push museum codex/nanami-museum:main
```

Expected: both succeed. If remote `main` advanced, stop and integrate safely; never force-push.

- [ ] **Step 3: Deploy Pages production**

Run:

```bash
npx wrangler pages deploy dist --project-name nanami-digital-museum --branch main --commit-dirty=false
```

Record the deployment URL returned by Cloudflare.

- [ ] **Step 4: Verify safe live reads**

Run:

```bash
curl -fsSL https://nanamicat.com/ -o /tmp/nanamicat-live.html
curl -fsS https://nanamicat.com/api/guestbook
curl -sS -o /dev/null -w '%{http_code}\n' https://nanamicat.com/api/guestbook/photos/not-a-real-entry
curl -fsSI https://nanamicat.com/favicon.png
curl -fsSI https://nanamicat.com/social/nanami-social-card.webp
curl -sS -o /dev/null -w '%{http_code}\n' https://nanamicat.com/models/nanami.glb
```

Expected: guestbook list is safe; unknown photo 404; favicon/social 200; old model 404.

- [ ] **Step 5: Run production browser smoke and record commit**

Run:

```bash
E2E_BASE_URL=https://nanamicat.com npm run test:e2e
git rev-parse HEAD
git ls-remote museum refs/heads/main
```

Expected: public read and layout checks pass; local and GitHub main hashes match. Do not automate a production write around the real Turnstile widget.
