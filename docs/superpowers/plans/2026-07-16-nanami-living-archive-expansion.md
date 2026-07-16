# Nanami Living Archive Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing six-chapter Nanami site into a bilingual, mobile-safe living archive with truthful profile data, reviewed photos, URL-addressable collections, rich archive metadata, and no remaining 3D runtime or assets.

**Architecture:** Keep the approved single-page chapter order and cinematic hero, but move factual profile data, translations, collection derivation, and metadata updates into focused typed modules. Archive records become the source of truth for gallery filters, counts, previews, timeline dates, and viewer details; components consume those derived values without hard-coded totals. Photo-library access is read-only and private, and only manually reviewed derivatives enter the repository.

**Tech Stack:** React 18, TypeScript 5.7, Vite 8, Tailwind/CSS, Framer Motion, Vitest, Testing Library, Playwright, Sharp, Cloudflare Pages, GitHub.

---

## File map

Create these focused modules:

- `src/profile/nanami.ts`: immutable Nanami facts and birthday-safe age calculation.
- `src/i18n/types.ts`: locale and localized-value types.
- `src/i18n/copy.ts`: complete English and Simplified Chinese UI dictionaries.
- `src/i18n/LocaleProvider.tsx`: locale detection, persistence, document language, and translation access.
- `src/archive/collections.ts`: valid URL collections, filtering, counts, previews, and latest verified date.
- `src/archive/url.ts`: parse and write `collection` while preserving the hash and browser history.
- `src/components/Profile.tsx`: factual replacement for `Presence`, retaining the existing chapter ID and composition.
- `src/components/SeoMetadata.tsx`: localized runtime meta tags and JSON-LD.
- `src/components/MobileMenu.tsx`: full-screen focus-trapped mobile navigation.
- `scripts/inventory-photos-library.mjs`: read-only candidate inventory with no file export or database mutation.
- `scripts/build-share-assets.mjs`: deterministic real-photo favicon and social-card generation.

Modify these existing modules:

- `src/main.tsx`, `src/App.tsx`, `src/components/Navigation.tsx`, `src/components/HeroPortrait.tsx`, `src/components/FieldNotes.tsx`, `src/components/MoodArchive.tsx`, `src/components/ArchiveViewer.tsx`, `src/components/LivingArchive.tsx`, `src/components/Closing.tsx`, `src/styles.css`.
- `src/archive/types.ts`, `src/archive/validate.ts`, `src/archive/items.ts`.
- `scripts/optimize-archive-assets.mjs`, `scripts/audit-public-assets.mjs`, `assets/source/archive-manifest.json`, `docs/references/archive-curation.md`.
- `index.html`, `package.json`, lockfile, and relevant unit/E2E tests.

Delete these legacy 3D modules and artifacts:

- `src/components/Hero3D.tsx`, `src/components/Hero3D.test.tsx`, `src/components/NanamiModel.tsx`.
- `scripts/build-nanami-model.mjs`, `scripts/render-nanami-model.mjs`.
- `assets/source/nanami-meshy-raw.glb`, its provenance file, `public/models/nanami.glb`, `public/models/nanami-mobile.glb`, and the unused model poster if no production reference remains.

### Task 1: Establish truthful profile facts and age calculation

**Files:**
- Create: `src/profile/nanami.ts`
- Create: `src/profile/nanami.test.ts`

- [ ] **Step 1: Write birthday-boundary tests**

```ts
import { describe, expect, it } from 'vitest'
import { getNanamiAge, nanamiProfile } from './nanami'

describe('nanamiProfile', () => {
  it('stores the approved facts', () => {
    expect(nanamiProfile).toMatchObject({
      name: 'Nanami',
      sex: 'male',
      birthDate: '2021-04-01',
      birthplace: { city: 'Utsunomiya', region: 'Tochigi', country: 'Japan' },
      species: 'cat',
      coat: 'black',
      eyeColor: 'yellow-green',
      signature: 'right-angle tail tip',
      collar: 'red',
      alive: true,
    })
  })

  it.each([
    ['2026-03-31T12:00:00+09:00', 4],
    ['2026-04-01T00:00:00+09:00', 5],
    ['2026-07-16T12:00:00+09:00', 5],
  ])('calculates age at %s', (date, expected) => {
    expect(getNanamiAge(new Date(date))).toBe(expected)
  })
})
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `npm test -- src/profile/nanami.test.ts`

Expected: FAIL because `src/profile/nanami.ts` does not exist.

- [ ] **Step 3: Add the immutable profile and local-calendar age helper**

```ts
export const nanamiProfile = Object.freeze({
  name: 'Nanami',
  sex: 'male' as const,
  birthDate: '2021-04-01',
  birthplace: Object.freeze({ city: 'Utsunomiya', region: 'Tochigi', country: 'Japan' }),
  species: 'cat' as const,
  coat: 'black',
  eyeColor: 'yellow-green',
  signature: 'right-angle tail tip',
  collar: 'red',
  alive: true,
})

export function getNanamiAge(now = new Date()): number {
  const birthYear = 2021
  const birthdayMonthIndex = 3
  const birthdayDay = 1
  const beforeBirthday =
    now.getMonth() < birthdayMonthIndex ||
    (now.getMonth() === birthdayMonthIndex && now.getDate() < birthdayDay)
  return now.getFullYear() - birthYear - Number(beforeBirthday)
}
```

- [ ] **Step 4: Run the focused test and verify green**

Run: `npm test -- src/profile/nanami.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the profile foundation**

```bash
git add src/profile/nanami.ts src/profile/nanami.test.ts
git commit -m "feat: add truthful Nanami profile facts"
```

### Task 2: Add typed bilingual locale state

**Files:**
- Create: `src/i18n/types.ts`
- Create: `src/i18n/copy.ts`
- Create: `src/i18n/LocaleProvider.tsx`
- Create: `src/i18n/LocaleProvider.test.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write locale detection and persistence tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocaleProvider, useLocale } from './LocaleProvider'

function Probe() {
  const { locale, setLocale, copy } = useLocale()
  return <><span>{locale}</span><span>{copy.nav.archive}</span><button onClick={() => setLocale('zh-CN')}>中文</button></>
}

describe('LocaleProvider', () => {
  beforeEach(() => localStorage.clear())

  it('uses Chinese for a Chinese browser and English otherwise', () => {
    Object.defineProperty(navigator, 'language', { configurable: true, value: 'zh-TW' })
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByText('zh-CN')).toBeVisible()
    expect(screen.getByText('档案')).toBeVisible()
  })

  it('lets a saved choice override browser language and persists changes', () => {
    localStorage.setItem('nanami-locale', 'en')
    render(<LocaleProvider><Probe /></LocaleProvider>)
    expect(screen.getByText('en')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '中文' }))
    expect(localStorage.getItem('nanami-locale')).toBe('zh-CN')
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})
```

- [ ] **Step 2: Run the locale tests and verify red**

Run: `npm test -- src/i18n/LocaleProvider.test.tsx`

Expected: FAIL because the locale modules do not exist.

- [ ] **Step 3: Define the locale contract and complete copy shape**

```ts
// src/i18n/types.ts
export type Locale = 'en' | 'zh-CN'
export type LocalizedText = Readonly<Record<Locale, string>>

// src/i18n/copy.ts
export const copy = {
  en: {
    nav: { home: 'Home', profile: 'Profile', notes: 'Field Notes', archive: 'Archive', timeline: 'Timeline', menu: 'Menu', close: 'Close' },
    hero: { title: 'ONE BLACK CAT.\nMANY MOODS.', disclosure: 'Cinematic portrait' },
    profile: { eyebrow: 'Profile · 01', title: 'He runs the house.', born: 'Born', birthplace: 'Birthplace', sex: 'Sex', male: 'Male', age: 'Age', years: 'years old' },
    archive: { all: 'All', photos: 'Photos', memes: 'Memes', portraits: 'Portraits', missingDate: 'Date not recorded', imageUnavailable: 'Image unavailable' },
  },
  'zh-CN': {
    nav: { home: '首页', profile: '档案', notes: '观察笔记', archive: '影像档案', timeline: '时间线', menu: '菜单', close: '关闭' },
    hero: { title: '一只黑猫。\n无数种表情。', disclosure: '艺术化肖像' },
    profile: { eyebrow: '个人档案 · 01', title: '这个家归他管。', born: '出生日期', birthplace: '出生地', sex: '性别', male: '男', age: '年龄', years: '岁' },
    archive: { all: '全部', photos: '照片', memes: '表情包', portraits: '肖像', missingDate: '日期未记录', imageUnavailable: '图片暂不可用' },
  },
} as const
```

Add these sibling keys to both locale objects so Tasks 5–8 consume one stable contract:

```ts
notes: {
  eyebrow: string,
  title: string,
  observed: string,
  ownerConfirmed: string,
  eyes: { term: string, detail: string, observation: string },
  tail: { term: string, detail: string, observation: string },
  collar: { term: string, detail: string, observation: string },
  doors: { term: string, detail: string, observation: string },
},
archive: {
  all: string,
  photos: string,
  memes: string,
  portraits: string,
  title: string,
  summary: string,
  filterLabel: string,
  ribbonLabel: string,
  empty: string,
  filterEmpty: string,
  missingDate: string,
  imageUnavailable: string,
  close: string,
  previous: string,
  next: string,
},
living: {
  eyebrow: string,
  title: string,
  summary: string,
  born: string,
  currentAge: string,
  latestCapture: string,
  collectionDescriptions: Record<'photos' | 'memes' | 'portraits', string>,
},
closing: { eyebrow: string, title: string, returnLink: string },
```

The English values are the approved existing copy corrected to `he/him/his`, including `Return to his territory`. The Chinese values are natural translations using `他`, including `主人确认`, `日期未记录`, `Nanami 可能正在看着你`, and `回到他的领地`. Components must read these keys directly; they must not contain locale conditionals.

- [ ] **Step 4: Implement safe locale detection and context**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { copy } from './copy'
import type { Locale } from './types'

const key = 'nanami-locale'
const isLocale = (value: unknown): value is Locale => value === 'en' || value === 'zh-CN'

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(key)
    if (isLocale(saved)) return saved
  } catch { /* private mode still gets a session locale */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

const LocaleContext = createContext<null | {
  locale: Locale
  setLocale: (locale: Locale) => void
  copy: typeof copy.en | typeof copy['zh-CN']
}>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)
  const setLocale = (next: Locale) => {
    setLocaleState(next)
    try { localStorage.setItem(key, next) } catch { /* state still updates */ }
  }
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  const value = useMemo(() => ({ locale, setLocale, copy: copy[locale] }), [locale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider')
  return value
}
```

Wrap `<App />` with `<LocaleProvider>` in `src/main.tsx`.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- src/i18n/LocaleProvider.test.tsx && npm run build`

Expected: locale tests PASS and TypeScript/Vite build succeeds.

- [ ] **Step 6: Commit locale infrastructure**

```bash
git add src/i18n src/main.tsx
git commit -m "feat: add bilingual locale infrastructure"
```

### Task 3: Expand and validate the localized archive model

**Files:**
- Modify: `src/archive/types.ts`
- Modify: `src/archive/validate.ts`
- Modify: `src/archive/items.ts`
- Create: `src/archive/collections.ts`
- Modify: `tests/archive.test.ts`
- Modify: `src/archive/items.test.ts`

- [ ] **Step 1: Replace the old archive fixtures with the new contract tests**

```ts
import { describe, expect, it } from 'vitest'
import { archiveItems } from '../src/archive/items'
import { collectionCounts, filterArchive, latestCaptureDate } from '../src/archive/collections'

describe('localized archive', () => {
  it('has reviewed localized records and responsive sources', () => {
    for (const item of archiveItems) {
      expect(item.faceChecked).toBe(true)
      expect(item.src640).toMatch(/^\/archive\/.+-640\.webp$/)
      expect(item.src1600).toMatch(/^\/archive\/.+-1600\.webp$/)
      expect(item.caption.en.trim()).not.toBe('')
      expect(item.caption['zh-CN'].trim()).not.toBe('')
      expect(item.alt.en).not.toMatch(/\b(she|her)\b/i)
      expect(item.alt['zh-CN']).not.toMatch(/她/)
    }
  })

  it('derives real collection membership and counts', () => {
    expect(collectionCounts(archiveItems).all).toBe(archiveItems.length)
    expect(collectionCounts(archiveItems).photos).toBe(filterArchive(archiveItems, 'photos').length)
    expect(collectionCounts(archiveItems).memes).toBe(filterArchive(archiveItems, 'memes').length)
    expect(collectionCounts(archiveItems).portraits).toBe(filterArchive(archiveItems, 'portraits').length)
    expect(filterArchive(archiveItems, 'portraits').every((item) => item.collections.includes('portraits'))).toBe(true)
  })

  it('uses only verified ISO capture dates for the latest date', () => {
    expect(latestCaptureDate(archiveItems)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run the archive tests and verify red**

Run: `npm test -- tests/archive.test.ts src/archive/items.test.ts`

Expected: FAIL on missing localized fields and collection helpers.

- [ ] **Step 3: Define the normalized archive types**

```ts
import type { LocalizedText } from '../i18n/types'

export type ArchiveType = 'photo' | 'meme'
export type ArchiveCollection = 'photos' | 'memes' | 'portraits'
export type ArchiveFilter = 'all' | ArchiveCollection

export interface ArchiveItemInput {
  id: string
  type: ArchiveType
  collections: readonly ArchiveCollection[]
  src640: string
  src1600: string
  caption: LocalizedText
  alt: LocalizedText
  captureDate?: string
  location?: LocalizedText
  story: LocalizedText
  faceChecked: boolean
  featured: boolean
  order: number
}

export type ArchiveItem = Readonly<ArchiveItemInput & { faceChecked: true }>
```

- [ ] **Step 4: Extend validation and add pure collection helpers**

```ts
// src/archive/collections.ts
import type { ArchiveCollection, ArchiveFilter, ArchiveItem } from './types'

export const archiveFilters: readonly ArchiveFilter[] = ['all', 'photos', 'memes', 'portraits']
export const isArchiveFilter = (value: string | null): value is ArchiveFilter =>
  value !== null && archiveFilters.includes(value as ArchiveFilter)

export function filterArchive(items: readonly ArchiveItem[], filter: ArchiveFilter) {
  return filter === 'all' ? items : items.filter((item) => item.collections.includes(filter))
}

export function collectionCounts(items: readonly ArchiveItem[]) {
  return Object.freeze({
    all: items.length,
    photos: filterArchive(items, 'photos').length,
    memes: filterArchive(items, 'memes').length,
    portraits: filterArchive(items, 'portraits').length,
  })
}

export function latestCaptureDate(items: readonly ArchiveItem[]) {
  return items.flatMap((item) => item.captureDate ? [item.captureDate] : []).sort().at(-1)
}

export function representativeItem(items: readonly ArchiveItem[], collection: ArchiveCollection) {
  return filterArchive(items, collection).find((item) => item.featured) ?? filterArchive(items, collection)[0]
}
```

In `validate.ts`, require non-empty unique `collections`, require `photos` for photo items and `memes` for meme items, validate both safe source paths, both localized caption/alt/story values, optional localized location, and optional `captureDate` against `/^\d{4}-\d{2}-\d{2}$/`. Freeze nested localized values and collection arrays before freezing each item.

- [ ] **Step 5: Migrate all 19 existing records**

For each record in `items.ts`, replace `src` with exact `src640`/`src1600` pairs, add `photos` or `memes`, tag only genuine close face studies as `portraits`, translate caption/alt/story, use only verified dates and locations, and remove every `she/her/她` reference. A migrated record must have this exact shape:

```ts
{
  id: 'nanami-photo-001',
  type: 'photo',
  collections: ['photos'],
  src640: '/archive/photos/nanami-photo-001-640.webp',
  src1600: '/archive/photos/nanami-photo-001-1600.webp',
  caption: { en: 'A sun-warmed pause.', 'zh-CN': '晒过太阳后的安静片刻。' },
  alt: { en: 'Nanami, a black cat, resting on a green chair with one eye partly open.', 'zh-CN': '黑猫 Nanami 躺在绿色椅子上，一只眼睛微微睁开。' },
  story: { en: 'A familiar chair, claimed for another afternoon nap.', 'zh-CN': '熟悉的椅子，再一次成为他的午睡领地。' },
  faceChecked: true,
  featured: true,
  order: 1,
}
```

- [ ] **Step 6: Run archive tests and commit**

Run: `npm test -- tests/archive.test.ts src/archive/items.test.ts`

Expected: all archive validation, immutability, localization, and count tests PASS.

```bash
git add src/archive tests/archive.test.ts
git commit -m "feat: localize and normalize Nanami archive data"
```

### Task 4: Curate up to 12 additional real Photos Library images

**Files:**
- Create: `scripts/inventory-photos-library.mjs`
- Create: `scripts/inventory-photos-library.test.mjs`
- Modify: `assets/source/archive-manifest.json`
- Add: reviewed files under `assets/source/archive/`
- Modify: `docs/references/archive-curation.md`
- Modify: `scripts/optimize-archive-assets.mjs`
- Modify: `scripts/optimize-archive-assets.test.mjs`

- [ ] **Step 1: Test the private inventory filter without touching Photos**

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseInventoryCandidates } from './inventory-photos-library.mjs'

test('keeps local still images and rejects known people-scene candidates', () => {
  const rows = [
    { uuid: 'safe', localState: 1, kind: 0, peopleScene: 0, width: 2000, height: 3000 },
    { uuid: 'cloud', localState: 0, kind: 0, peopleScene: 0, width: 2000, height: 3000 },
    { uuid: 'person', localState: 1, kind: 0, peopleScene: 1, width: 2000, height: 3000 },
    { uuid: 'video', localState: 1, kind: 1, peopleScene: 0, width: 1920, height: 1080 },
  ]
  assert.deepEqual(chooseInventoryCandidates(rows).map(({ uuid }) => uuid), ['safe'])
})
```

- [ ] **Step 2: Run the inventory test and verify red**

Run: `node --test scripts/inventory-photos-library.test.mjs`

Expected: FAIL because the inventory module does not exist.

- [ ] **Step 3: Implement read-only inventory with private output**

The script must export `chooseInventoryCandidates`, open this database URI with the system `sqlite3` command, and write only a private review JSON outside the repository:

```js
const libraryDb = 'file:/Users/zdh/Pictures/Photos Library.photoslibrary/database/Photos.sqlite?immutable=1'
const reviewPath = '/Users/zdh/Documents/NanamiCat/.superpowers/private/nanami-photo-candidates.json'

export function chooseInventoryCandidates(rows) {
  return rows.filter((row) =>
    row.localState > 0 &&
    row.kind === 0 &&
    row.peopleScene === 0 &&
    row.width >= 1200 &&
    row.height >= 1200,
  )
}
```

Use this exact read-only SQL query joining `ZASSET` and `ZADDITIONALASSETATTRIBUTES`; it deliberately omits filesystem directories, filenames, GPS coordinates, person identities, and face rows:

```sql
SELECT json_object(
  'uuid', a.ZUUID,
  'captureDate', datetime(a.ZDATECREATED + 978307200, 'unixepoch'),
  'width', a.ZWIDTH,
  'height', a.ZHEIGHT,
  'localState', a.ZCLOUDLOCALSTATE,
  'kind', a.ZKIND,
  'peopleScene', COALESCE(x.ZHASPEOPLESCENEMIDORGREATERCONFIDENCE, 0),
  'favorite', a.ZFAVORITE,
  'aestheticScore', COALESCE(a.ZOVERALLAESTHETICSCORE, 0)
)
FROM ZASSET AS a
LEFT JOIN ZADDITIONALASSETATTRIBUTES AS x
  ON a.ZADDITIONALATTRIBUTES = x.Z_PK
WHERE a.ZTRASHEDSTATE = 0
  AND a.ZHIDDEN = 0
  AND a.ZKIND = 0
  AND a.ZDATECREATED >= (strftime('%s', '2021-04-01') - 978307200)
ORDER BY a.ZFAVORITE DESC, a.ZOVERALLAESTHETICSCORE DESC, a.ZDATECREATED ASC
LIMIT 300;
```

- [ ] **Step 4: Run the read-only inventory and record availability**

Run:

```bash
node --test scripts/inventory-photos-library.test.mjs
node scripts/inventory-photos-library.mjs
```

Expected: test PASS; script reports total local candidates and creates the private review JSON. It must not change the Photos library and must not request iCloud downloads.

- [ ] **Step 5: Review visual candidates and export only approved originals**

Inspect generated thumbnails/candidates in date order and select at most 12 images in this priority: visible right-angle tail tip; 2021 kitten period; early Utsunomiya/home context; eyes/red collar; distinct patrol, sleep, or expression moments. Reject every human face, partial face, reflection, screen face, near duplicate, blur, or misleading tail crop. Export only selected locally available Photos items, then convert the reviewed originals to neutral `nanami-photo-NNN.webp` masters with metadata stripped.

If no image clearly shows the tail tip, do not select a substitute as tail evidence; record `tail-photo: none` in the private review notes and retain an owner-confirmed text-only field note.

- [ ] **Step 6: Lock reviewed hashes and regenerate public derivatives**

Append the exact SHA-256 values of only approved neutral masters to `assets/source/archive-manifest.json`, add localized records and verified Photos capture dates to `src/archive/items.ts`, then run:

```bash
npm run archive:build
npm run audit:assets
npm test -- scripts/optimize-archive-assets.test.mjs src/archive/items.test.ts tests/archive.test.ts
```

Expected: two public WebP derivatives per photo, no embedded EXIF/IPTC/XMP, exact reviewed-source hashes, no original Photos UUID/path/GPS data in tracked files, and no more than 12 new photos.

- [ ] **Step 7: Document neutral provenance and commit**

Update `docs/references/archive-curation.md` with neutral IDs, capture dates or `Date not recorded`, manual no-human-face review status, and tail-evidence result. Do not include Photos UUIDs, original filenames, absolute paths, GPS, or people names.

```bash
git add assets/source/archive assets/source/archive-manifest.json public/archive src/archive/items.ts scripts/inventory-photos-library.mjs scripts/inventory-photos-library.test.mjs scripts/optimize-archive-assets.mjs scripts/optimize-archive-assets.test.mjs docs/references/archive-curation.md
git commit -m "feat: expand the reviewed Nanami photo archive"
```

### Task 5: Build URL-synchronized archive filters and rich viewer metadata

**Files:**
- Create: `src/archive/url.ts`
- Create: `src/archive/url.test.ts`
- Modify: `src/components/MoodArchive.tsx`
- Modify: `src/components/ArchiveViewer.tsx`
- Modify: `tests/archive-viewer.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Test URL parsing, invalid fallback, and localized fallbacks**

```ts
import { describe, expect, it } from 'vitest'
import { collectionFromLocation, collectionUrl } from './url'

describe('archive collection URLs', () => {
  it('parses valid values and falls back to all', () => {
    expect(collectionFromLocation('?collection=portraits')).toBe('portraits')
    expect(collectionFromLocation('?collection=invalid')).toBe('all')
    expect(collectionFromLocation('')).toBe('all')
  })

  it('preserves unrelated query values and points to the archive hash', () => {
    expect(collectionUrl('photos', '?ref=home')).toBe('?ref=home&collection=photos#mood-archive')
    expect(collectionUrl('all', '?ref=home&collection=memes')).toBe('?ref=home#mood-archive')
  })
})
```

- [ ] **Step 2: Run focused tests and verify red**

Run: `npm test -- src/archive/url.test.ts tests/archive-viewer.test.tsx`

Expected: URL tests fail because `url.ts` is missing; viewer tests fail on absent localized metadata.

- [ ] **Step 3: Implement URL helpers**

```ts
import { isArchiveFilter } from './collections'
import type { ArchiveFilter } from './types'

export function collectionFromLocation(search: string): ArchiveFilter {
  const value = new URLSearchParams(search).get('collection')
  return isArchiveFilter(value) ? value : 'all'
}

export function collectionUrl(filter: ArchiveFilter, search: string) {
  const params = new URLSearchParams(search)
  if (filter === 'all') params.delete('collection')
  else params.set('collection', filter)
  const query = params.toString()
  return `${query ? `?${query}` : ''}#mood-archive`
}
```

- [ ] **Step 4: Make MoodArchive derive its UI from locale and URL**

Initialize state with `collectionFromLocation(window.location.search)`. On filter click, call `history.pushState({ collection: value }, '', collectionUrl(value, location.search))`, close the viewer, and filter through `filterArchive`. Subscribe to `popstate` and restore state. Render four localized filters, localized count-aware card labels, localized capture dates through `Intl.DateTimeFormat(locale)`, localized location when present, and `copy.archive.missingDate` when `captureDate` is absent.

- [ ] **Step 5: Enrich ArchiveViewer without weakening modal behavior**

Use `item.src1600`, `item.alt[locale]`, `item.caption[locale]`, localized date fallback, optional `location[locale]`, and `item.story[locale]`. Keep existing Escape/arrow/focus-trap/body-lock behavior and localize Close/Previous/Next/Image unavailable labels.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- src/archive/url.test.ts tests/archive-viewer.test.tsx src/components/MoodArchive.test.tsx`

Expected: URL restore, four filters, missing date, omitted missing location, viewer details, focus restore, and keyboard controls PASS.

```bash
git add src/archive/url.ts src/archive/url.test.ts src/components/MoodArchive.tsx src/components/ArchiveViewer.tsx src/components/MoodArchive.test.tsx tests/archive-viewer.test.tsx src/styles.css
git commit -m "feat: add addressable archive collections"
```

### Task 6: Replace Presence with the factual bilingual Profile chapter

**Files:**
- Create: `src/components/Profile.tsx`
- Create: `src/components/Profile.test.tsx`
- Delete: `src/components/Presence.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write a fixed-date profile rendering test**

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { Profile } from './Profile'

it('renders Nanami as a five-year-old male born in Utsunomiya', () => {
  vi.setSystemTime(new Date('2026-07-16T12:00:00+09:00'))
  render(<LocaleProvider><Profile staticExperience /></LocaleProvider>)
  expect(screen.getByRole('heading', { name: 'He runs the house.' })).toBeVisible()
  expect(screen.getByText('5 years old')).toBeVisible()
  expect(screen.getByText('April 1, 2021')).toBeVisible()
  expect(screen.getByText('Utsunomiya, Tochigi, Japan')).toBeVisible()
  expect(screen.getByText('Male')).toBeVisible()
})
```

- [ ] **Step 2: Run the profile test and verify red**

Run: `npm test -- src/components/Profile.test.tsx`

Expected: FAIL because `Profile.tsx` does not exist.

- [ ] **Step 3: Implement Profile using the factual source of truth**

Retain `id="presence"`, `data-museum-section="presence"`, the current real reviewed photo, reveal motion, and existing layout classes. Build the fact rows with this data flow:

```tsx
const { locale, copy } = useLocale()
const age = getNanamiAge()
const birthDate = new Intl.DateTimeFormat(locale, {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo',
}).format(new Date(`${nanamiProfile.birthDate}T00:00:00+09:00`))
const birthplace = locale === 'zh-CN'
  ? '日本栃木县宇都宫市'
  : 'Utsunomiya, Tochigi, Japan'
const facts = [
  [copy.profile.age, `${age} ${copy.profile.years}`],
  [copy.profile.born, birthDate],
  [copy.profile.birthplace, birthplace],
  [copy.profile.sex, copy.profile.male],
] as const
```

Render `copy.profile.title` as the heading, map `facts` to definition-list rows, and preserve the reviewed `nanami-photo-002` responsive image. English must say `He runs the house`; Chinese must say `这个家归他管`.

- [ ] **Step 4: Wire Profile into the stable six-chapter App shell**

Replace the `Presence` import and render with `Profile`. Keep exactly these chapter IDs and order: `hero`, `presence`, `field-notes`, `mood-archive`, `living-archive`, `closing`.

- [ ] **Step 5: Run component tests and commit**

Run: `npm test -- src/components/Profile.test.tsx src/App.test.tsx`

Expected: factual profile and stable chapter-order assertions PASS.

```bash
git add src/components/Profile.tsx src/components/Profile.test.tsx src/components/Presence.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: turn presence into Nanami profile"
```

### Task 7: Add bilingual desktop navigation and accessible full-screen mobile menu

**Files:**
- Create: `src/components/MobileMenu.tsx`
- Create: `src/components/MobileMenu.test.tsx`
- Modify: `src/components/Navigation.tsx`
- Modify: `src/components/Navigation.test.tsx`
- Modify: `src/hooks/useBodyScrollLock.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write mobile menu interaction tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { Navigation } from './Navigation'

it('opens, traps focus, closes on Escape, and restores the trigger', () => {
  render(<LocaleProvider><Navigation /></LocaleProvider>)
  const trigger = screen.getByRole('button', { name: 'Menu' })
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Menu' })).toBeVisible()
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('switches language from the menu and closes after navigation', () => {
  render(<LocaleProvider><Navigation /></LocaleProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  fireEvent.click(screen.getByRole('button', { name: '中' }))
  expect(screen.getByRole('link', { name: '观察笔记' })).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: '观察笔记' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run menu tests and verify red**

Run: `npm test -- src/components/MobileMenu.test.tsx src/components/Navigation.test.tsx`

Expected: FAIL because the menu and locale controls do not exist.

- [ ] **Step 3: Implement MobileMenu**

Render a portal/dialog below the fixed header with this exact navigation model:

```tsx
const links = [
  ['home', '#hero'],
  ['profile', '#presence'],
  ['notes', '#field-notes'],
  ['archive', '#mood-archive'],
  ['timeline', '#living-archive'],
] as const
```

`MobileMenu` receives `{ open, onClose, returnFocusTo }`, renders only when open, calls `useBodyScrollLock(open)`, focuses the Close button in an effect, handles Escape on `document`, traps Tab/Shift+Tab using the same `focusableSelector` as `ArchiveViewer`, closes each link with `onClick={onClose}`, and restores `returnFocusTo.current?.focus()` in cleanup. Set `#root` inert/`aria-hidden` while its portal is open and restore previous values on cleanup so the menu and archive viewer cannot both expose background content.

- [ ] **Step 4: Update responsive navigation**

Desktop maps the same five-link model and renders two buttons with `aria-pressed={locale === 'zh-CN'}` and `aria-pressed={locale === 'en'}`. Add one `menuOpen` state, a `menuTriggerRef`, and pass both to `MobileMenu`. Below 768px, `.navigation__desktop` uses `display:none`; at 768px and above, `.navigation__menu-trigger` uses `display:none`. The trigger is a 44px-minimum button labeled `copy.nav.menu`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- src/components/MobileMenu.test.tsx src/components/Navigation.test.tsx tests/archive-viewer.test.tsx`

Expected: menu keyboard behavior, body lock, focus restore, locale switching, and existing archive viewer modal behavior PASS.

```bash
git add src/components/MobileMenu.tsx src/components/MobileMenu.test.tsx src/components/Navigation.tsx src/components/Navigation.test.tsx src/hooks/useBodyScrollLock.ts src/styles.css
git commit -m "feat: add bilingual mobile museum navigation"
```

### Task 8: Localize Field Notes, Living Archive, hero, and closing

**Files:**
- Modify: `src/components/HeroPortrait.tsx`
- Modify: `src/components/FieldNotes.tsx`
- Modify: `src/components/LivingArchive.tsx`
- Modify: `src/components/Closing.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add component assertions for truth, derivation, and locale**

```tsx
it('uses male pronouns, real collection counts, and factual timeline data', () => {
  render(<LocaleProvider><App /></LocaleProvider>)
  expect(screen.getByText('He runs the house.')).toBeVisible()
  expect(screen.queryByText(/\b(she|her)\b/i)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /View \d+ photos/ })).toHaveAttribute('href', '?collection=photos#mood-archive')
  expect(screen.getByRole('link', { name: /View \d+ portraits/ })).toHaveAttribute('href', '?collection=portraits#mood-archive')
  expect(screen.getByText('Born in Utsunomiya, Tochigi')).toBeVisible()
  expect(screen.getByText('April 1, 2021')).toBeVisible()
})
```

- [ ] **Step 2: Run App tests and verify red**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL on pronouns, derived URL links, and timeline.

- [ ] **Step 3: Localize and correct Field Notes**

Build four note records from the selected locale and this media mapping:

```tsx
const notes = [
  { key: 'eyes', image: '/archive/photos/nanami-photo-003-640.webp' },
  { key: 'tail', image: verifiedTailPhoto?.src640 },
  { key: 'collar', image: '/archive/photos/nanami-photo-002-640.webp' },
  { key: 'doors', image: '/archive/photos/nanami-photo-007-640.webp' },
] as const
```

For `tail`, derive `verifiedTailPhoto` only from a curated archive record explicitly tagged for visible tail evidence during Task 4. If it is undefined, omit the `<figure>`, add the class `field-note--text-only`, and label the observation with `copy.notes.ownerConfirmed`. All record text comes from `copy.notes[key]` and uses `he/him/his` or `他`.

- [ ] **Step 4: Derive Living Archive directory and timeline**

Use this derived model and render it without hard-coded counts:

```tsx
const collections = (['photos', 'memes', 'portraits'] as const).map((name) => ({
  name,
  count: collectionCounts(archiveItems)[name],
  preview: representativeItem(archiveItems, name),
  href: collectionUrl(name, window.location.search),
}))
const latest = latestCaptureDate(archiveItems)
const timeline = [
  { date: '2021-04-01', label: copy.living.born },
  { date: String(new Date().getFullYear()), label: `${copy.living.currentAge}: ${getNanamiAge()} ${copy.profile.years}` },
  ...(latest ? [{ date: latest, label: copy.living.latestCapture }] : []),
]
```

On a directory link click, allow the URL navigation, then focus `#mood-archive` after the next animation frame. Accessible labels combine localized collection name and derived count.

- [ ] **Step 5: Localize hero and closing without changing hero composition**

Keep `/hero/nanami-cinematic-hero.webp`, its crop, title placement, and `NNM_000001`. Add `Cinematic portrait / 艺术化肖像` beside the archive index. Translate the hero title and closing copy, retain the real 2D closing face, and change the English return link to `Return to his territory`.

- [ ] **Step 6: Run the pronoun sweep and tests**

Run:

```bash
rg -n -i '\b(she|her|hers)\b|她' src tests index.html
npm test -- src/App.test.tsx src/components/FieldNotes.test.tsx
```

Expected: `rg` returns no incorrect female pronouns; component tests PASS. Do not replace unrelated words containing these letter sequences.

- [ ] **Step 7: Commit localized chapters**

```bash
git add src/components/HeroPortrait.tsx src/components/FieldNotes.tsx src/components/FieldNotes.test.tsx src/components/LivingArchive.tsx src/components/Closing.tsx src/App.tsx src/App.test.tsx src/i18n/copy.ts src/styles.css
git commit -m "feat: complete bilingual Nanami museum chapters"
```

### Task 9: Remove all legacy 3D code, models, scripts, dependencies, and CSS

**Files:**
- Create: `tests/no-3d.test.ts`
- Delete: `src/components/Hero3D.tsx`
- Delete: `src/components/Hero3D.test.tsx`
- Delete: `src/components/NanamiModel.tsx`
- Delete: `scripts/build-nanami-model.mjs`
- Delete: `scripts/render-nanami-model.mjs`
- Delete: `public/models/nanami.glb`
- Delete: `public/models/nanami-mobile.glb`
- Delete: `assets/source/nanami-meshy-raw.glb`
- Delete: matching provenance/model-only poster when unreferenced
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add a repository-level no-3D regression test**

```ts
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('2D-only museum', () => {
  it('contains no deployed models or 3D runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.dependencies).not.toHaveProperty('three')
    expect(pkg.dependencies).not.toHaveProperty('@react-three/fiber')
    expect(pkg.dependencies).not.toHaveProperty('@react-three/drei')
    expect(pkg.dependencies).not.toHaveProperty('@gltf-transform/core')
    expect(pkg.dependencies).not.toHaveProperty('@gltf-transform/cli')
    expect(pkg.scripts).not.toHaveProperty('model:build')
    expect(pkg.scripts).not.toHaveProperty('model:render')
    expect(existsSync('public/models')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the no-3D test and verify red**

Run: `npm test -- tests/no-3d.test.ts`

Expected: FAIL on dependencies, scripts, and model directory.

- [ ] **Step 3: Remove the legacy implementation**

Delete the files listed above. Run `npm uninstall three @react-three/fiber @react-three/drei @gltf-transform/core @gltf-transform/cli`, remove `model:build`, `model:browser:install`, and `model:render`, and delete `.hero-3d-*`, `.hero-poster*`, and model-only CSS while preserving `.hero-portrait`, `.hero-visual`, vignette, and 2D mobile hero styles.

- [ ] **Step 4: Verify source, build, and artifact cleanliness**

Run:

```bash
rg -n 'Hero3D|NanamiModel|@react-three|from .three.|/models/|\.glb|hero-3d|model:build|model:render' src scripts tests package.json public assets || true
npm test -- tests/no-3d.test.ts src/App.test.tsx
npm run build
find public dist -type f \( -iname '*.glb' -o -iname '*.gltf' \)
```

Expected: no matches or model files; tests PASS; build succeeds.

- [ ] **Step 5: Commit the 2D-only cleanup**

```bash
git add -A
git commit -m "refactor: remove legacy Nanami 3D pipeline"
```

### Task 10: Add truthful SEO, social sharing, favicon, and runtime metadata

**Files:**
- Create: `src/components/SeoMetadata.tsx`
- Create: `src/components/SeoMetadata.test.tsx`
- Create: `scripts/build-share-assets.mjs`
- Create: `scripts/build-share-assets.test.mjs`
- Add: `public/favicon.png`
- Add: `public/social/nanami-social-card.webp`
- Modify: `src/App.tsx`
- Modify: `index.html`
- Modify: `package.json`

- [ ] **Step 1: Write metadata truth tests**

```tsx
import { render } from '@testing-library/react'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { SeoMetadata } from './SeoMetadata'

it('publishes living male-cat metadata and canonical sharing URLs', () => {
  render(<LocaleProvider><SeoMetadata /></LocaleProvider>)
  expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://nanamicat.com/')
  expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://nanamicat.com/social/nanami-social-card.webp')
  const json = JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')
  expect(JSON.stringify(json)).toContain('male')
  expect(JSON.stringify(json)).toContain('2021-04-01')
  expect(JSON.stringify(json)).not.toMatch(/memorial|deceased/i)
})
```

- [ ] **Step 2: Run metadata tests and verify red**

Run: `npm test -- src/components/SeoMetadata.test.tsx scripts/build-share-assets.test.mjs`

Expected: FAIL because metadata and asset builder do not exist.

- [ ] **Step 3: Generate share assets from reviewed real imagery**

Use Sharp with these deterministic operations in `build-share-assets.mjs`:

```js
await sharp('assets/source/archive/nanami-photo-003.webp', { failOn: 'error' })
  .rotate()
  .resize(512, 512, { fit: 'cover', position: sharp.strategy.attention })
  .png({ compressionLevel: 9 })
  .toFile('public/favicon.png')

await sharp('public/hero/nanami-cinematic-hero.webp', { failOn: 'error' })
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .webp({ quality: 88, effort: 6 })
  .toFile('public/social/nanami-social-card.webp')
```

Read each output with `sharp(...).metadata()` and throw unless dimensions are 512×512 and 1200×630. Add `"share:build": "node scripts/build-share-assets.mjs"` to `package.json`. Both inputs are already reviewed and contain no human faces.

- [ ] **Step 4: Add static and localized runtime metadata**

In `index.html`, add the canonical URL, `/favicon.png`, English fallback title/description, `og:title`, `og:description`, `og:image`, `og:type=website`, `og:url`, `og:locale`, `twitter:card=summary_large_image`, and Twitter title/description/image. `SeoMetadata` selects these values:

```ts
const metadata = {
  en: { title: 'Nanami Cat — A Living Archive', description: 'The living digital archive of Nanami, a black cat born in Utsunomiya, Tochigi.' },
  'zh-CN': { title: 'Nanami Cat — 生活数字档案', description: '黑猫 Nanami 的生活数字档案。他出生于日本栃木县宇都宫市。' },
} as const
```

On locale changes, update `document.title`, description, `og:title`, `og:description`, `og:locale`, and Twitter title/description. Insert one JSON-LD script whose `@graph` contains a `WebSite` and a subject object with `name: Nanami`, `additionalType: Cat`, `gender: male`, `birthDate: 2021-04-01`, `birthPlace: Utsunomiya, Tochigi, Japan`, and `disambiguatingDescription: living black cat`. Do not create a `Person` node or use memorial/deceased language.

- [ ] **Step 5: Run asset, metadata, and build verification**

Run:

```bash
npm run share:build
npm test -- src/components/SeoMetadata.test.tsx scripts/build-share-assets.test.mjs
npm run audit:assets
npm run build
```

Expected: favicon is 512×512, social card is 1200×630, metadata tests PASS, public image metadata audit PASS, and build succeeds.

- [ ] **Step 6: Commit SEO and share assets**

```bash
git add index.html package.json package-lock.json src/components/SeoMetadata.tsx src/components/SeoMetadata.test.tsx scripts/build-share-assets.mjs scripts/build-share-assets.test.mjs public/favicon.png public/social/nanami-social-card.webp src/App.tsx
git commit -m "feat: add truthful Nanami sharing metadata"
```

### Task 11: Complete desktop, mobile, history, accessibility, and reduced-motion E2E coverage

**Files:**
- Modify: `tests/museum.spec.ts`
- Modify: `tests/reduced-experience.test.ts`
- Modify: `playwright.config.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Update E2E expectations to the approved release behavior**

Add Playwright tests that assert:

```ts
await expect(page.getByRole('heading', { name: 'He runs the house.' })).toBeVisible()
await page.getByRole('button', { name: 'Photos', exact: true }).click()
await expect(page).toHaveURL(/\?collection=photos#moo[d]-archive$/)
await page.reload()
await expect(page.getByRole('button', { name: 'Photos', exact: true })).toHaveAttribute('aria-pressed', 'true')
await page.getByRole('button', { name: 'Portraits', exact: true }).click()
await page.goBack()
await expect(page.getByRole('button', { name: 'Photos', exact: true })).toHaveAttribute('aria-pressed', 'true')
```

Also test Chinese rendering after clicking `中`, persistence after reload, mobile menu open/Escape/focus restore/body scroll lock, directory-to-filter navigation and focus, viewer date/location/story, missing-date fallback, no horizontal overflow at 320px and 390px, minimum 44px touch targets, no console/page/request failures, and no canvas/GLB/`/models/` requests.

- [ ] **Step 2: Run E2E and observe failures before CSS fixes**

Run: `npm run test:e2e`

Expected: new tests expose any remaining mobile overflow, focus, URL, locale, or copy issues.

- [ ] **Step 3: Apply only evidence-driven layout and interaction fixes**

Adjust `src/styles.css` for the failing 320/390px cases: full-screen menu height beneath the fixed header, wrapping fact rows, readable overlay gradients, archive ribbon/card widths, 44px controls, viewer metadata scrolling, and reduced-motion transitions. Preserve desktop hero framing and section order.

- [ ] **Step 4: Run the complete local release gate**

Run:

```bash
npm test
npm run archive:build
npm run share:build
npm run audit:assets
npm run build
npm run test:e2e
rg -n -i '\b(she|her|hers)\b|她|memorial|deceased' src tests index.html public || true
find public dist -type f \( -iname '*.glb' -o -iname '*.gltf' \)
```

Expected: all unit/component/script tests PASS; asset builds and audit PASS; Vite build PASS; desktop/mobile E2E PASS; no incorrect sex/memorial language; no GLB/GLTF files.

- [ ] **Step 5: Perform visual review at approved widths**

Use browser screenshots at 1440×900, 390×844, and 320×700 for all six chapters in English and Chinese. Confirm the desktop hero image, crop, title, and Nanami position remain unchanged apart from the language/menu/disclosure additions; verify no human face appears in any public image and the tail note does not visually overclaim.

- [ ] **Step 6: Commit final QA fixes**

```bash
git add tests/museum.spec.ts tests/reduced-experience.test.ts playwright.config.ts src/styles.css
git commit -m "test: cover bilingual mobile archive release"
```

### Task 12: Push to GitHub, deploy Cloudflare Pages, and verify production

**Files:**
- No source changes expected; deployment records come from Git/GitHub/Cloudflare.

- [ ] **Step 1: Verify the release branch and clean tree**

Run:

```bash
git status --short
git log --oneline --decorate -12
git remote -v
```

Expected: clean worktree; all task commits present; `museum` points to `git@github.com:zdh2333/nanami-digital-museum.git`.

- [ ] **Step 2: Push the release branch and update GitHub main**

Run:

```bash
git push museum codex/nanami-museum
git push museum codex/nanami-museum:main
```

Expected: both pushes succeed and GitHub `main` resolves to the verified release commit. If remote `main` advanced independently, stop and integrate it safely instead of force-pushing.

- [ ] **Step 3: Deploy the exact verified build to Cloudflare Pages**

Run:

```bash
npx wrangler pages deploy dist --project-name nanami-digital-museum --branch main --commit-dirty=false
```

Expected: Cloudflare returns a successful production deployment URL for project `nanami-digital-museum`.

- [ ] **Step 4: Verify live HTML, assets, and model absence**

Run:

```bash
curl -fsSL https://nanamicat.com/ -o /tmp/nanamicat-live.html
rg -n 'canonical|og:image|twitter:card|nanami-social-card|favicon' /tmp/nanamicat-live.html
curl -fsSI https://nanamicat.com/social/nanami-social-card.webp
curl -fsSI https://nanamicat.com/favicon.png
curl -sS -o /dev/null -w '%{http_code}\n' https://nanamicat.com/models/nanami.glb
```

Expected: live HTML contains canonical/social metadata; social image and favicon return 200; the old model URL returns 404.

- [ ] **Step 5: Run production desktop and mobile smoke tests**

Run:

```bash
E2E_BASE_URL=https://nanamicat.com npm run test:e2e
```

Expected: all live desktop/mobile tests PASS, including bilingual persistence, URL filters/history, menu accessibility, photo viewer metadata, no runtime errors, and no 3D requests.

- [ ] **Step 6: Record the final deployed commit**

Run:

```bash
git rev-parse HEAD
git ls-remote museum refs/heads/main
```

Expected: local HEAD and GitHub main hashes match. Report the commit, Cloudflare deployment URL, `https://nanamicat.com/`, test totals, photo count, and privacy/3D audit results.

---

## Self-review checklist

- Every approved spec section is covered: profile facts, male pronouns, age, photo curation/privacy, localized archive records, derived counts/portraits, URL filters/history, directory/timeline, locale persistence, mobile menu/focus/body lock, real 2D closing, 3D removal, SEO/social assets/JSON-LD, accessibility/reduced motion, error fallbacks, and production deployment.
- The implementation contains no new route, account, upload, comment, public editing, invented dates/locations, AI documentary evidence, memorial language, or bulk iCloud download.
- The desktop hero composition is protected by explicit E2E/visual acceptance.
- Public data never includes Photos UUIDs, original paths, GPS, person identities, or metadata-bearing originals.
- Dates are either verified ISO capture dates or the localized missing-date label; filenames and modification times are never treated as capture dates.
- All commands are scoped to `/Users/zdh/Documents/NanamiCat/.worktrees/codex-nanami-museum` unless an absolute read-only Photos Library path is shown.
