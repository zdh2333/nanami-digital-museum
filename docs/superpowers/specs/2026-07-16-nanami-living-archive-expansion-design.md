# Nanami Living Archive Expansion Design

Date: 2026-07-16  
Project: Nanami Cat Digital Museum  
Production: https://nanamicat.com/  
Repository: `zdh2333/nanami-digital-museum`

## Objective

Expand the existing six-chapter Nanami Cat single-page museum without replacing its cinematic structure. Make the archive more truthful, navigable, bilingual, maintainable, and useful on mobile while removing all remaining 3D code and assets.

Nanami is a male black cat, born on 2021-04-01 in Utsunomiya, Tochigi, Japan. His age must be calculated from the birth date instead of stored as a fixed number.

## Approved Direction

The approved approach is **A: content-first single-page living archive**.

The existing chapter order remains:

1. Hero
2. Profile / Presence
3. Field Notes
4. Mood Archive
5. Living Archive
6. Closing

The redesign enriches the contents and interactions inside these chapters. It does not add routes or replace the current visual identity.

## Visual System

Preserve the existing system:

- Obsidian background
- Bone-white display type
- Muted green archival labels and borders
- Monospace metadata
- Full-bleed or tightly framed Nanami photographs
- Restrained blur-and-rise reveal motion
- Square corners and thin borders rather than generic rounded cards

The desktop hero image, headline, composition, and Nanami position remain unchanged. The mobile hero keeps its current portrait crop and native text overlay.

### Hero changes

- Add a compact `中 / EN` control to desktop navigation.
- Add a mobile menu trigger.
- Add a small archival disclosure beside the archive index: `Cinematic portrait / 艺术化肖像`.
- Do not add a hero CTA, profile card, badge, or extra marketing copy.

## Profile Data

Create one typed source of truth for Nanami:

- Name: Nanami
- Sex: male
- Birth date: 2021-04-01
- Birthplace: Utsunomiya, Tochigi, Japan
- Species: cat
- Coat: black
- Eye color: yellow-green
- Signature: right-angle tail tip
- Collar: red

The profile chapter displays:

- Current age, calculated from the birth date
- Birth date
- Birthplace
- Sex
- A real reviewed Nanami photograph

All English copy uses `he / him / his`. All Chinese copy uses `他`. Existing `she / her` references must be removed from visible copy, alt text, tests, metadata, and structured data.

## Field Notes

Keep the four approved observations:

1. Yellow-green eyes
2. Right-angle tail tip
3. Red collar
4. Zero closed doors

Each observation contains a real reviewed photograph, short description, and owner-confirmed observation. The right-angle tail entry must use a real photograph that clearly shows the tail tip. If no qualifying photograph exists, the entry remains text-led and explicitly identifies the statement as an owner-confirmed note. AI-generated tail evidence is prohibited.

## Photo Expansion And Privacy

Curate up to 12 additional images from the local Mac Photos library.

Priority order:

1. Clear right-angle tail tip
2. Nanami as a kitten in 2021
3. Utsunomiya environment or early home life
4. Direct eye contact and red collar
5. Distinct sleeping, patrol, and expression moments

Public asset rules:

- No visible human faces
- Reject blurred, poorly framed, or near-duplicate images
- Do not expose original Photos Library paths or private metadata
- Export reviewed derivatives only
- Generate 640px and 1600px WebP derivatives
- Preserve source capture dates separately in archive data when available
- If a capture date is missing, display `Date not recorded / 日期未记录`
- Do not infer a date from a filename or file modification time

## Archive Data Model

Extend each archive item with:

- Stable ID
- Type: photo or meme
- Collection membership: photos, memes, portraits
- 640px and 1600px sources
- Localized caption
- Localized alt text
- Capture date when verified
- Localized location when verified
- Localized story or note
- Face-review status
- Featured status
- Sort order

Collection counts must be derived from the archive data. They must never be hard-coded in components.

Portraits are a real derived collection, not a label that points to all photos. An item may belong to both `photos` and `portraits`.

## Archive Filtering And URLs

The Mood Archive supports:

- All
- Photos
- Memes
- Portraits

Selecting a filter updates the displayed items and writes the filter into the URL:

`?collection=photos#mood-archive`

On initial load, the application reads a valid collection from the URL and restores the filter. Invalid values fall back to `all` without breaking the page.

The Living Archive directory links set the corresponding filter and move focus to the Mood Archive. Native back and forward navigation must restore the correct filter.

Each card displays capture date and location when known. The full-screen viewer displays the localized caption, date, location, and story.

## Living Archive And Timeline

The fifth chapter remains a collection directory and adds a compact factual timeline:

- 2021-04-01: Born in Utsunomiya, Tochigi
- Current year: calculated age
- Latest verified archive capture date

The directory lists the three real collections with automatically calculated counts and representative preview images.

## Bilingual Architecture

Supported locales:

- `zh-CN`
- `en`

Initial locale selection:

1. Use a previously saved user selection from local storage.
2. Otherwise use Chinese when the browser language begins with `zh`.
3. Otherwise use English.

The manual `中 / EN` control updates the page immediately and saves the preference. It also updates:

- Navigation
- Headings and body copy
- Archive filters
- Captions, alt text, dates, locations, and stories
- Mobile menu
- Document language
- Page title and description
- Accessible labels

All copy lives in typed dictionaries or localized archive data. Components must not contain scattered bilingual conditionals.

## Mobile Navigation

Desktop navigation remains visually consistent with the current header.

At widths below 768px:

- Keep `Nanami` as the home link.
- Replace the single `Explore` shortcut with a `Menu` control.
- Open a full-screen obsidian menu below the fixed header.
- Include links to Home, Profile, Field Notes, Archive, and Timeline.
- Include `中 / EN` inside the menu.
- Close on link selection, Escape, or explicit Close.
- Trap focus while open and restore focus to the trigger when closed.
- Prevent background scrolling while open.

## Closing Chapter

Keep the existing real 2D close portrait and masked face treatment. Translate the copy and ensure the ending uses male pronouns. No canvas, GLB, CSS-drawn eyes, or simulated 3D elements are allowed.

## 3D Removal

Delete all unused 3D implementation and artifacts:

- `Hero3D` component and tests
- `NanamiModel` component
- Public GLB files
- Model generation and rendering scripts
- Three.js, React Three Fiber, and Drei dependencies
- Obsolete model scripts from `package.json`
- Dead 3D CSS
- Tests and mocks that reference the legacy hero

The production build and public directory must contain no GLB files and the application must make no `/models/` requests.

## SEO And Sharing

Add:

- Canonical URL for `https://nanamicat.com/`
- Open Graph title, description, image, type, URL, and locale
- Twitter card metadata
- Favicon generated from a reviewed real Nanami face crop
- 1200×630 social sharing image derived from reviewed site artwork
- JSON-LD describing the website and Nanami as the subject of a personal living archive
- Localized document title and meta description after hydration

Structured data must identify Nanami as alive and male. It must not use memorial or deceased-person language.

## Motion And Accessibility

- Continue respecting `prefers-reduced-motion`.
- Preserve current reveal motion for users who allow animation.
- Every filter, menu item, language control, image viewer control, and archive link is keyboard accessible.
- Focus is visible and never lost after modal or menu closure.
- Mobile touch targets are at least 44px.
- Text remains readable over photographs at 320px width.
- Alt text remains factual and does not claim a visible tail feature when the crop does not show it.

## Error And Fallback Behavior

- Missing image: show the existing accessible image-unavailable state.
- Missing date: show localized `Date not recorded`.
- Missing location: omit the location rather than inventing one.
- Invalid collection URL: fall back to All.
- Local storage unavailable: keep the current session locale without throwing.
- Photos Library item unavailable locally: skip it and continue curation; do not trigger bulk iCloud downloads without explicit need.
- No qualifying tail photograph: use owner-confirmed text without fabricated visual evidence.

## Component Boundaries

- `nanamiProfile`: factual profile and age calculation
- `LocaleProvider`: locale detection, persistence, and translated copy access
- `Navigation`: desktop navigation and mobile menu shell
- `Profile`: factual profile chapter
- `FieldNotes`: localized observed features and verified media
- `MoodArchive`: URL-synchronized filter and gallery
- `ArchiveViewer`: localized detailed media view
- `LivingArchive`: derived counts, collection links, and timeline
- `SeoMetadata`: localized runtime metadata and JSON-LD

The archive data layer owns counts, classification, and metadata. Components only render derived values and dispatch navigation changes.

## Testing

### Unit and component tests

- Age calculation around the April 1 birthday boundary
- Browser-language locale selection
- Saved locale preference override
- Male pronouns in both locales
- Automatic collection counts
- Portrait membership
- URL filter parsing and invalid-value fallback
- Mobile menu open, close, Escape, focus restore, and scroll lock
- Missing-date and missing-location fallbacks
- SEO metadata and JSON-LD facts
- No legacy 3D imports or model URLs

### Browser tests

- Desktop and 390px mobile layouts
- Chinese and English rendering
- Menu keyboard and touch interaction
- Filter URL persistence, reload, and browser history
- Photo viewer metadata
- No horizontal overflow
- No runtime warnings or failed requests
- Reduced-motion behavior
- No canvas, GLB, or `/models/` requests

### Asset verification

- Face privacy audit over every public image
- 640px and 1600px derivative pair validation
- Capture-date provenance for dated items
- No publicly deployed original Photos Library files

## Deployment Acceptance

Before completion:

1. Unit tests pass.
2. Asset privacy audit passes.
3. Production build passes.
4. Local desktop and mobile browser suites pass.
5. GitHub `main` contains the release commit.
6. Cloudflare Pages production deploy succeeds.
7. `nanamicat.com` serves the new asset hashes.
8. Live desktop and mobile browser smoke tests pass.
9. The public deployment contains no GLB files or 3D runtime code.

## Intentional Constraints

- No multi-page routing in this release.
- No account system, uploads, comments, or public editing.
- No invented birthday, dates, locations, or personality facts.
- No AI-generated image presented as documentary evidence.
- No memorial language; Nanami is alive and the archive is ongoing.
