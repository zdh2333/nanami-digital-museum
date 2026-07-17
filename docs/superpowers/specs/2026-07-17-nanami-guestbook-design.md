# Nanami Guestbook Design

**Date:** 2026-07-17  
**Status:** Approved for planning  
**Scope:** Add a bilingual public guestbook to the living Nanami digital archive, then deploy it with the existing Cloudflare Pages project.

## Purpose

The guestbook gives visitors a small, carefully bounded way to speak to Nanami: a nickname, a plain-text note, a cat-themed emoji, and optionally one cat photo. It is a museum visitor log, not a general social feed. Nanami is alive; all copy keeps the living-archive framing.

Public photo use remains stricter than text: a submitted photo appears only after the owner reviews it in the Cloudflare console and confirms it contains a cat and no human face.

## Confirmed product decisions

- Placement: a new Guestbook chapter follows Living Archive and precedes the existing Closing portrait.
- Publishing: text and selected emoji appear immediately after successful submission. Photos remain private and `pending` until approved.
- Identity: no account. A visitor supplies a 1–24 character nickname and passes Turnstile for every write.
- Photo policy: at most one cat photo per entry; JPEG, PNG, or WebP only; no SVG, GIF, or other media; 5 MB maximum.
- Moderation: the owner uses the Cloudflare dashboard, not a custom administration page.
- Retention: entries and approved images are retained until the owner manually removes them.
- Emoji: entries may include one selected cat-themed emoji; visitors can add or remove the fixed reaction set `🐈‍⬛`, `🖤`, `🐾`, `😺`, and `✨`.
- Visual direction: use only real, already approved Nanami photographs in the site’s guestbook visuals. No SVG cat art. Generated imagery must never be represented as a documentary record of Nanami.

## Visual and interaction design

The new chapter is titled `Guestbook / 访客簿` and has the English lead `Leave a pawprint for Nanami.` with a matching Chinese localized line. It maintains the archive’s editorial dark-green palette but is intentionally more tactile than the existing archive grid:

- a real Nanami photograph is the large chapter visual;
- a rounded, translucent entry desk holds nickname, message, emoji stamps, one-photo control, Turnstile, and submit action;
- published entries are slightly offset, paper-like cards with real approved cat photos only;
- reaction controls are small circular stamps, not generic social-media controls;
- a real-photo ribbon leads into the existing Closing portrait;
- desktop uses the entry desk and visitor stream side by side; mobile collapses to a single column with 44px-or-larger controls.

The form labels, status messages, image alt text, empty state, date format, and moderation language are bilingual through the existing locale provider. There is no memorial wording and no female pronouns.

## Architecture

The static site remains on the existing Cloudflare Pages project, `nanami-digital-museum`.

### Pages Functions

Pages Functions provide the public API under `/api/guestbook`:

- `GET /api/guestbook?cursor=` returns up to 12 non-hidden entries, their aggregate reactions, and public URLs only for `approved` photos.
- `POST /api/guestbook` validates Turnstile, nickname, text, selected emoji, cookie, rate limit, and an optional multipart photo. It creates the entry and publishes the text immediately. If a photo is supplied, it is stored only after sanitization and remains `pending`.
- `POST /api/guestbook/:id/reactions` validates Turnstile and toggles one allowed reaction for the current anonymous browser.
- `GET /api/guestbook/photos/:id` reads an R2 object only after D1 confirms the linked entry is public, not hidden, and photo status is `approved`.

Pages Functions use D1 and R2 bindings. Their Wrangler configuration becomes the project configuration source of truth only after it is downloaded from the current Pages project and reviewed; it is not handwritten over unknown production configuration.

### Private image sanitizer Worker

Pages’ documented project bindings cover D1 and R2, while Cloudflare Images is configured as a Worker binding. A small route-less Worker named `nanami-image-sanitizer` receives only an internal Service Binding request from Pages Functions.

It accepts a validated image stream, uses the Cloudflare Images binding to limit the longest edge to 1600px, applies EXIF orientation, and outputs WebP with metadata disabled. The Pages Function saves only that WebP in the private R2 bucket under a random `pending/` key. The original upload is never persisted or publicly addressable.

The Pages project calls the sanitizer through a Service Binding. The sanitizer has no public custom route and does not receive a visitor’s identity.

### D1 model

`guestbook_entries`

| column | meaning |
| --- | --- |
| `id` | opaque UUID-like entry identifier |
| `nickname` | validated display name |
| `message` | escaped plain text |
| `entry_emoji` | one allowed optional emoji |
| `photo_key` | private R2 key, or `NULL` |
| `photo_status` | `none`, `pending`, `approved`, or `rejected` |
| `hidden` | owner moderation flag |
| `created_at` | UTC timestamp |

`guestbook_reactions` uses a unique `(entry_id, visitor_hash, emoji)` key. `visitor_hash` is an HMAC of a random, signed, HttpOnly first-party browser cookie. The database contains no raw cookie, visitor name, email address, or IP address.

`guestbook_rate_events` stores only a keyed HMAC fingerprint and timestamps long enough to enforce write limits. It does not store raw IP addresses.

## Privacy, validation, and moderation

- All text is trimmed, Unicode-normalized, length-checked, and rendered as text, never HTML. URLs are not automatically linked.
- Server-side file validation checks declared MIME type, magic bytes, decodeability, dimensions, and size. Unsupported formats are rejected fail-closed.
- Re-encoding to WebP removes EXIF/GPS and original filename metadata before any object is written to R2. Cloudflare’s image transformation documentation supports metadata removal for transformed image output.
- Turnstile is validated server-side with Siteverify for every entry and reaction. A token is single-use and expires quickly; client-side presence alone is never trusted.
- A keyed anonymous fingerprint may create at most three entries and 24 reaction changes in a rolling ten-minute window. Rate-limited, expired Turnstile, malformed upload, and network errors leave the visitor’s form draft intact and show localized recovery text.
- `pending` and `rejected` image keys are never returned by the public API and cannot be fetched through the image route.
- The owner reviews pending objects in R2 and their linked D1 rows in the Cloudflare dashboard. Only after visually confirming a cat-only image with no human face does the owner change `photo_status` to `approved`. Rejected images are manually deleted from R2 and marked `rejected` in D1.
- The owner can set `hidden = 1` or delete any entry in the Cloudflare console. Documentation will include safe, exact query and deletion steps.

## Operational configuration

Production needs:

- a D1 database and private R2 bucket;
- the route-less sanitizer Worker with a Cloudflare Images binding;
- a Pages-to-Worker Service Binding;
- a Turnstile widget for `nanamicat.com`;
- Pages secrets for the Turnstile secret and HMAC signing key;
- a public Pages variable for the Turnstile site key.

No secret is committed. Local-only `.dev.vars*` files stay ignored. If Cloudflare authentication is required, use the user’s Google sign-in in the existing Cloudflare account session.

## Testing and acceptance criteria

### Unit and API tests

- validate all text, emoji, image type, magic-byte, size, status, HMAC, and pagination rules;
- verify sanitization requests WebP output with metadata disabled;
- verify pending/rejected photos never receive public URLs;
- verify approved photos are reachable only through the guarded route;
- verify Turnstile failures, duplicate tokens, rate limits, and invalid reactions are rejected;
- verify cookie-hash reaction toggling and uniqueness.

### Browser tests

- desktop 1440×900 and mobile 390×844/320×700 in English and Chinese;
- form labels, keyboard order, focus handling, touch target sizing, live error/status messages, and reduced-motion behavior;
- text and emoji submission using local Turnstile test configuration;
- cat upload reaches `pending`, is absent from public results, then appears only after a local D1 approval fixture;
- reactions add and remove correctly;
- no horizontal overflow, console/page/request failures, human-face asset regressions, 3D requests, canvas, GLB, or GLTF files.

### Release gate

Run existing archive/share/privacy/build/no-3D checks plus guestbook unit/API/UI/E2E tests. Manually review guestbook screenshots with real Nanami photos at all approved widths. Production verification confirms public read paths, private pending-photo denial, metadata/social preservation, and safe empty state. Production writes remain protected by real Turnstile and are not automated with test keys.

## Non-goals

- accounts, Google sign-in for visitors, direct messaging, profiles, arbitrary emoji, arbitrary media, video, live chat, an owner-built admin UI, automatic face detection, or bulk import of guest images;
- treating generated art as a real Nanami photo;
- exposing pending, rejected, original, metadata-bearing, or human-face-containing photos.
