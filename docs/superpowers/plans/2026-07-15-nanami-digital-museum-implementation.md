# Nanami Personal Digital Museum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, verify, and deploy a cinematic single-page digital museum for the living black cat Nanami at `https://nanamicat.com/`, with a faithful interactive 3D model, real photographs, and memes.

**Architecture:** A static React/TypeScript/Vite application renders six full-viewport narrative sections. React Three Fiber owns the optimized GLB and its fallbacks; typed local archive data owns all photos and memes; build-time privacy checks reject unreviewed or metadata-bearing assets. A new GitHub repository and Cloudflare Pages project provide a reversible cutover while preserving the existing puzzle repository and deployment.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js, React Three Fiber, Drei, Vitest, Testing Library, Playwright, exifr, Cloudflare Pages, GitHub CLI.

---

## Planned File Structure

```text
.
├── index.html                         # Metadata, fonts, social tags, app mount
├── package.json                       # Scripts and pinned runtime/tooling dependencies
├── vite.config.ts                     # React and Vitest configuration
├── playwright.config.ts               # Desktop/mobile browser projects
├── tailwind.config.ts                 # Night Life Archive tokens
├── postcss.config.cjs                 # Tailwind/PostCSS pipeline
├── tsconfig.json                      # Strict TypeScript configuration
├── public/
│   ├── archive/photos/                # Metadata-stripped responsive photos
│   ├── archive/memes/                 # Metadata-stripped responsive memes
│   ├── models/nanami.glb              # Optimized canonical model
│   ├── models/nanami-mobile.glb       # Lower-weight mobile model
│   └── posters/nanami-hero.webp       # WebGL/reduced-motion fallback
├── scripts/
│   ├── audit-public-assets.mjs        # EXIF and allowlist audit
│   └── optimize-archive-assets.sh     # Repeatable image conversion
├── src/
│   ├── main.tsx                       # React entrypoint
│   ├── App.tsx                        # Six-section composition
│   ├── styles.css                     # Global tokens and non-utility effects
│   ├── archive/
│   │   ├── types.ts                   # ArchiveItem contract
│   │   ├── items.ts                   # Curated public archive data
│   │   └── validate.ts                # Runtime/build invariants
│   ├── components/
│   │   ├── Navigation.tsx             # Fixed responsive navigation
│   │   ├── ScrambleText.tsx           # Accessible text effect
│   │   ├── Hero3D.tsx                 # Canvas, model, loading, fallback
│   │   ├── NanamiModel.tsx             # GLB loading and pointer response
│   │   ├── FieldNotes.tsx             # Identity observation section
│   │   ├── MoodArchive.tsx            # Photo/meme gallery
│   │   ├── ArchiveViewer.tsx           # Accessible modal viewer
│   │   └── LivingArchive.tsx           # Three-collection summary
│   ├── hooks/
│   │   ├── useReducedExperience.ts     # Reduced-motion/WebGL decision
│   │   └── useBodyScrollLock.ts        # Viewer scroll management
│   └── test/setup.ts                   # Testing Library setup
└── tests/
    ├── archive.test.ts                 # Data and privacy manifest rules
    ├── reduced-experience.test.ts      # Motion/WebGL behavior
    ├── archive-viewer.test.tsx         # Keyboard and focus behavior
    └── museum.spec.ts                  # Six sections and responsive smoke paths
```

## Task 1: Generate and Approve Six Section Concepts

**Files:**
- Create: `docs/references/section-01-hero.png`
- Create: `docs/references/section-02-presence.png`
- Create: `docs/references/section-03-field-notes.png`
- Create: `docs/references/section-04-mood-archive.png`
- Create: `docs/references/section-05-living-archive.png`
- Create: `docs/references/section-06-closing.png`

- [ ] **Step 1: Generate the hero concept**

Use the approved Nanami turnaround as the character reference. Generate one 16:9 horizontal desktop section with this exact brief:

```text
Nanami Night Life Archive hero, deep obsidian full viewport, subtle ink-green living-system glow, one faithful black cat with yellow-green eyes, slim red collar and clearly kinked right-angle tail tip centered as the only hero object, giant restrained type “ONE BLACK CAT. MANY MOODS.”, fixed translucent navigation labeled Nanami / About / Field Notes / Photos / Memes / Explore, cinematic image-as-canvas composition, generous negative space, code-native typography and controls, no mourning language, no purple AI glow, no card grid.
```

Save the accepted output as `docs/references/section-01-hero.png`.

- [ ] **Step 2: Generate Presence and Field Notes concepts**

Generate two separate 16:9 images, never a combined board:

```text
Presence: full-bleed real Nanami photograph with dark tonal overlay, off-grid giant statement “She runs the house.”, short supporting sentence, slow parallax implied, same obsidian/ink-green palette.

Field Notes: near-black technical editorial field, oversized identifiers YELLOW-GREEN EYES / RIGHT-ANGLE TAIL / RED COLLAR / ZERO CLOSED DOORS, one macro eye or tail crop, precise monospace labels, no fake metrics.
```

Save them as sections 02 and 03.

- [ ] **Step 3: Generate Mood Archive, Living Archive, and Closing concepts**

Generate three separate 16:9 images:

```text
Mood Archive: horizontal ribbon of real Nanami photos and memes with one enlarged selected image, gallery controls and captions readable, varied image crops, black and ink-green frame system.

Living Archive: three collections Photos / Memes / 3D shown as an asymmetric editorial stack, one model crop and two real photos, headline “Three collections. Always growing.”

Closing: mini-minimalist dark scene with Nanami seated in the right third, headline “Nanami is probably watching you.”, last updated label and restrained GitHub link, clearly ongoing and alive.
```

Save them as sections 04–06.

- [ ] **Step 4: Present all six concepts for user approval**

Open each image at original detail and compare palette, type system, spacing, navigation, CTA family, and Nanami identity. Do not scaffold code until all six are accepted.

- [ ] **Step 5: Commit approved concepts**

```bash
git add docs/references
git commit -m "design: add approved museum section concepts"
```

Expected: one commit containing exactly six section images.

## Task 2: Produce the Canonical Nanami GLB

**Files:**
- Create: `public/models/nanami.glb`
- Create: `public/models/nanami-mobile.glb`
- Create: `public/posters/nanami-hero.webp`
- Create: `docs/references/nanami-model-review.png`

- [ ] **Step 1: Prepare metadata-free model inputs**

Use the approved corrected turnaround and 4–6 supporting Nanami photos with no human faces. Re-encode every input before external upload:

```bash
mkdir -p /tmp/nanami-model-inputs
for src in /tmp/nanami-refs-clean/*.{jpg,jpeg,png}(N); do
  ffmpeg -y -i "$src" -map_metadata -1 -q:v 2 "/tmp/nanami-model-inputs/${src:t:r}.jpg"
done
```

Run `file /tmp/nanami-model-inputs/*` and verify each item is JPEG or PNG.

- [ ] **Step 2: Confirm the Meshy upload at action time**

Tell the user that metadata-free Nanami images will be uploaded to Meshy solely to generate the model. Proceed only after confirmation.

- [ ] **Step 3: Generate and inspect the model**

Use Meshy image-to-3D or multi-view generation with textures enabled and GLB output. Reject a result if any of these fail:

```text
- black short coat remains continuous
- yellow-green eyes remain symmetric
- large ears and slim proportions match the turnaround
- red collar is slim and unbroken
- tail ends in a visible approximately 90-degree kink
- no extra limbs, people, props, text, or floor geometry
```

- [ ] **Step 4: Optimize desktop and mobile GLBs**

Install `@gltf-transform/cli` as a dev dependency, then run:

```bash
npx gltf-transform optimize input.glb public/models/nanami.glb --compress draco --texture-compress webp
npx gltf-transform optimize input.glb public/models/nanami-mobile.glb --compress draco --texture-compress webp --texture-size 1024
```

Expected: both commands succeed; the mobile file is smaller than the desktop file.

- [ ] **Step 5: Render the static fallback and review sheet**

Export a 16:9 hero poster and a four-angle review image from the accepted model. Save them to the paths above and inspect both with `view_image`.

- [ ] **Step 6: Commit the model artifacts**

```bash
git add public/models public/posters docs/references/nanami-model-review.png
git commit -m "feat: add optimized Nanami 3D model"
```

## Task 3: Scaffold the Tested React Application

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.cjs`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create package metadata and scripts**

Use this script contract in `package.json`:

```json
{
  "name": "nanami-digital-museum",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "audit:assets": "node scripts/audit-public-assets.mjs"
  }
}
```

Install React 18, Framer Motion 12, Three.js, React Three Fiber 8, Drei 9, Tailwind 3, Vite 5, TypeScript, Vitest, Testing Library, Playwright, exifr, and glTF Transform.

```bash
npm install react@18.3.1 react-dom@18.3.1 framer-motion@12.40.0 three@0.170.0 @react-three/fiber@8.18.0 @react-three/drei@9.122.0
npm install -D typescript@5.7.3 vite@5.4.14 @vitejs/plugin-react@4.3.4 tailwindcss@3.4.17 postcss@8.5.1 autoprefixer@10.4.20 vitest@2.1.8 jsdom@25.0.1 @testing-library/react@16.1.0 @testing-library/jest-dom@6.6.3 @playwright/test@1.49.1 exifr@7.1.3 @gltf-transform/cli@4.1.1 @types/react@18.3.18 @types/react-dom@18.3.5 @types/three@0.170.0
```

- [ ] **Step 2: Add a failing mount test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the living archive title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /one black cat/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and verify failure**

```bash
npm run test:run -- src/App.test.tsx
```

Expected: FAIL because `App` is not implemented.

- [ ] **Step 4: Implement the minimal app shell**

```tsx
export function App() {
  return <main><h1>One black cat. Many moods.</h1></main>;
}
```

- [ ] **Step 5: Configure Tailwind, Vitest, and strict TypeScript**

Set `test.environment` to `jsdom`, load `src/test/setup.ts`, and import `@testing-library/jest-dom/vitest` in setup. Define colors `obsidian`, `ink`, `life`, and `mist` in Tailwind.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:run -- src/App.test.tsx
npm run build
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tailwind.config.ts postcss.config.cjs src
git commit -m "chore: scaffold tested museum app"
```

Expected: test PASS and production build succeeds.

## Task 4: Add Typed Archive Data and Privacy Validation

**Files:**
- Create: `src/archive/types.ts`
- Create: `src/archive/items.ts`
- Create: `src/archive/validate.ts`
- Create: `tests/archive.test.ts`
- Create: `scripts/audit-public-assets.mjs`

- [ ] **Step 1: Write failing archive contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { validateArchive } from '../src/archive/validate';

describe('validateArchive', () => {
  it('rejects assets without human-face review', () => {
    expect(() => validateArchive([{ id:'x', type:'photo', src:'/x.webp', caption:'x', alt:'x', faceChecked:false, featured:false, order:1 }])).toThrow(/face review/i);
  });

  it('rejects duplicate ids', () => {
    const item = { id:'x', type:'photo' as const, src:'/x.webp', caption:'x', alt:'x', faceChecked:true, featured:false, order:1 };
    expect(() => validateArchive([item, item])).toThrow(/duplicate/i);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
npm run test:run -- tests/archive.test.ts
```

Expected: FAIL because the archive modules do not exist.

- [ ] **Step 3: Implement the type and validator**

```ts
export type ArchiveType = 'photo' | 'meme';
export interface ArchiveItemInput {
  id: string; type: ArchiveType; src: string; caption: string; alt: string;
  displayDate?: string; faceChecked: boolean; featured: boolean; order: number;
}
export type ArchiveItem = ArchiveItemInput & { faceChecked: true };

export function validateArchive(items: readonly ArchiveItemInput[]): readonly ArchiveItem[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.faceChecked !== true) throw new Error(`Face review missing: ${item.id}`);
    if (ids.has(item.id)) throw new Error(`Duplicate archive id: ${item.id}`);
    if (!item.src.startsWith('/archive/')) throw new Error(`Invalid public path: ${item.id}`);
    ids.add(item.id);
  }
  return items as readonly ArchiveItem[];
}
```

- [ ] **Step 4: Implement the EXIF audit script**

Use `exifr` to scan files under `public/archive`. Fail when metadata contains `latitude`, `longitude`, `Make`, `Model`, `DateTimeOriginal`, or `CreateDate`; print `Asset privacy audit passed` only when clean.

```js
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'exifr';

const root = fileURLToPath(new URL('../public/archive/', import.meta.url));
const forbidden = ['latitude', 'longitude', 'Make', 'Model', 'DateTimeOriginal', 'CreateDate'];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

const failures = [];
for (const file of await walk(root)) {
  const metadata = await parse(file, { pick: forbidden }).catch(() => ({}));
  const leaked = forbidden.filter((key) => metadata?.[key] !== undefined);
  if (leaked.length) failures.push(`${file}: ${leaked.join(', ')}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Asset privacy audit passed');
}
```

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- tests/archive.test.ts
npm run audit:assets
git add src/archive tests/archive.test.ts scripts/audit-public-assets.mjs
git commit -m "feat: add validated private-by-default archive data"
```

## Task 5: Build Navigation and Accessible Motion Primitives

**Files:**
- Create: `src/components/Navigation.tsx`
- Create: `src/components/ScrambleText.tsx`
- Create: `src/hooks/useReducedExperience.ts`
- Create: `tests/reduced-experience.test.ts`

- [ ] **Step 1: Write failing reduced-experience tests**

Test that `shouldUseStaticExperience(true, true)` and `shouldUseStaticExperience(false, false)` return `true`, while `shouldUseStaticExperience(false, true)` returns `false`.

- [ ] **Step 2: Run the test and verify failure**

```bash
npm run test:run -- tests/reduced-experience.test.ts
```

- [ ] **Step 3: Implement the pure decision function**

```ts
export const shouldUseStaticExperience = (reducedMotion: boolean, webglAvailable: boolean) => reducedMotion || !webglAvailable;
```

The hook reads `matchMedia('(prefers-reduced-motion: reduce)')` and a one-time WebGL capability probe.

- [ ] **Step 4: Implement Navigation and ScrambleText**

Keep the real text in an `aria-label`, mark scrambled glyphs `aria-hidden`, use buttons and anchor links, and provide a 44px minimum touch target. The primary action scrolls to `#mood-archive`.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- tests/reduced-experience.test.ts
npm run build
git add src/components src/hooks tests/reduced-experience.test.ts
git commit -m "feat: add accessible navigation and motion primitives"
```

## Task 6: Implement the 3D Hero and Static Fallback

**Files:**
- Create: `src/components/Hero3D.tsx`
- Create: `src/components/NanamiModel.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/Hero3D.test.tsx`

- [ ] **Step 1: Write the failing fallback test**

Render `<Hero3D staticExperience />` and assert that an image with alt text `Nanami, a black cat with yellow-green eyes and a kinked tail tip` is visible and no canvas exists.

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/components/Hero3D.test.tsx
```

- [ ] **Step 3: Implement the fallback branch**

```tsx
if (staticExperience) {
  return <img src="/posters/nanami-hero.webp" alt="Nanami, a black cat with yellow-green eyes and a kinked tail tip" />;
}
```

- [ ] **Step 4: Implement Canvas and model interaction**

Use `<Canvas dpr={[1, 1.75]} camera={{ position:[0,1.1,4.5], fov:32 }}>`, load the correct desktop/mobile GLB, clamp pointer-driven rotation, preserve drag-to-rotate, and stop animation updates while `document.hidden` is true.

- [ ] **Step 5: Verify Tail Identity at Runtime**

Capture desktop and mobile hero screenshots. Inspect the accepted model directly; the right-angle tail tip and red collar must be readable without rotating to an obscure angle.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:run -- src/components/Hero3D.test.tsx
npm run build
git add src/components/Hero3D.tsx src/components/NanamiModel.tsx src/components/Hero3D.test.tsx src/App.tsx
git commit -m "feat: add interactive Nanami 3D hero"
```

## Task 7: Implement the Six Narrative Sections

**Files:**
- Create: `src/components/Presence.tsx`
- Create: `src/components/FieldNotes.tsx`
- Create: `src/components/LivingArchive.tsx`
- Create: `src/components/Closing.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add a failing six-section test**

Render `App` with the 3D component mocked and assert the section IDs are exactly `hero`, `presence`, `field-notes`, `mood-archive`, `living-archive`, and `closing`.

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- src/App.test.tsx
```

- [ ] **Step 3: Implement sections in approved order**

Each component owns one section, one heading, and one visual role. Use Framer Motion only when the reduced-experience hook is false. Field Notes must render the four approved identifiers verbatim.

- [ ] **Step 4: Implement responsive section rhythm**

Match the six accepted concept images at 1440×900 and 390×844. Preserve `100dvh`, legible overlays, and at least 24px mobile side padding.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- src/App.test.tsx
npm run build
git add src/App.tsx src/components src/styles.css
git commit -m "feat: build the six museum narrative sections"
```

## Task 8: Build the Mood Archive and Accessible Viewer

**Files:**
- Create: `src/components/MoodArchive.tsx`
- Create: `src/components/ArchiveViewer.tsx`
- Create: `src/hooks/useBodyScrollLock.ts`
- Create: `tests/archive-viewer.test.tsx`

- [ ] **Step 1: Write failing keyboard behavior tests**

Test that opening an item renders a dialog, ArrowRight advances, ArrowLeft returns, Escape closes, and focus returns to the opening thumbnail.

- [ ] **Step 2: Run and verify failure**

```bash
npm run test:run -- tests/archive-viewer.test.tsx
```

- [ ] **Step 3: Implement the gallery and dialog**

Use semantic buttons for thumbnails, `role="dialog"`, `aria-modal="true"`, an explicit close button, and document key listeners installed only while open. Captions and display dates come from `ArchiveItem`.

- [ ] **Step 4: Add touch and scroll behavior**

Use horizontal snapping for the ribbon, preserve vertical page scroll, and lock body scroll only while the viewer is open.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- tests/archive-viewer.test.tsx
npm run build
git add src/components/MoodArchive.tsx src/components/ArchiveViewer.tsx src/hooks/useBodyScrollLock.ts tests/archive-viewer.test.tsx
git commit -m "feat: add accessible Nanami photo and meme archive"
```

## Task 9: Curate and Optimize Production Photos and Memes

**Files:**
- Create: `scripts/optimize-archive-assets.sh`
- Create: `public/archive/photos/*.webp`
- Create: `public/archive/memes/*.webp`
- Modify: `src/archive/items.ts`

- [ ] **Step 1: Select the production set**

Choose 12–18 real Nanami photos and 6–10 memes from the identified pet cluster. Exclude human faces, reflections with faces, screenshots containing private conversations, location clues, and images dominated by hands or partial people.

- [ ] **Step 2: Create the optimization script**

For each approved source, use `ffmpeg -map_metadata -1` to produce 640px and 1600px WebP variants. Output filenames use stable neutral IDs such as `nanami-001.webp`, never Photos UUIDs or original filenames.

```bash
#!/usr/bin/env zsh
set -euo pipefail
src_dir=${1:?usage: optimize-archive-assets.sh SOURCE_DIR OUTPUT_DIR}
out_dir=${2:?usage: optimize-archive-assets.sh SOURCE_DIR OUTPUT_DIR}
mkdir -p "$out_dir"
index=1
for src in "$src_dir"/*.{jpg,jpeg,png,heic}(N); do
  id=$(printf 'nanami-%03d' "$index")
  ffmpeg -y -hide_banner -loglevel error -i "$src" -map_metadata -1 -vf "scale='min(640,iw)':-2" -c:v libwebp -quality 82 "$out_dir/${id}-640.webp"
  ffmpeg -y -hide_banner -loglevel error -i "$src" -map_metadata -1 -vf "scale='min(1600,iw)':-2" -c:v libwebp -quality 86 "$out_dir/${id}-1600.webp"
  index=$((index + 1))
done
```

- [ ] **Step 3: Populate typed archive data**

Add a unique ID, public path, factual alt text, short caption, optional display date, `faceChecked: true`, featured flag, and display order for every item.

- [ ] **Step 4: Run privacy and data checks**

```bash
npm run audit:assets
npm run test:run -- tests/archive.test.ts
```

Expected: `Asset privacy audit passed` and tests PASS.

- [ ] **Step 5: Commit curated assets**

```bash
git add scripts/optimize-archive-assets.sh public/archive src/archive/items.ts
git commit -m "content: add reviewed Nanami photos and memes"
```

## Task 10: Add Browser Tests and Visual Fidelity Checks

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/museum.spec.ts`

- [ ] **Step 1: Write the six-section smoke test**

```ts
import { test, expect } from '@playwright/test';

test('renders the complete living archive', async ({ page }) => {
  await page.goto('/');
  for (const id of ['hero','presence','field-notes','mood-archive','living-archive','closing']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.getByText('Nanami is probably watching you.')).toBeVisible();
});
```

- [ ] **Step 2: Add interaction and fallback tests**

Cover navigation scrolling, viewer keyboard behavior, a reduced-motion emulation, mobile touch viewport, and WebGL-disabled poster fallback.

- [ ] **Step 3: Run browser tests**

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: desktop and mobile Chromium projects PASS.

- [ ] **Step 4: Compare concepts and implementation**

Capture every section at 1440×900 and 390×844. Use `view_image` on each accepted concept and corresponding browser screenshot. Fix typography, spacing, crop, palette, and interaction-state mismatches until agency sign-off fidelity is reached.

- [ ] **Step 5: Run the full local gate and commit**

```bash
npm run test:run
npm run audit:assets
npm run build
npm run test:e2e
git add playwright.config.ts tests
git commit -m "test: cover museum interactions and responsive layouts"
```

## Task 11: Create GitHub Backup and Cloudflare Preview

**Files:**
- Modify: `.git/config` through `gh repo create`

- [ ] **Step 1: Confirm the existing production remains untouched**

Record the current live response, repository head, and Cloudflare project/domain mapping. Do not modify `zdh2333/nanamicat` or its main branch.

- [ ] **Step 2: Create and push the new repository**

```bash
git branch -m main
gh repo create zdh2333/nanami-digital-museum --public --source=. --remote=origin --push
```

Expected: the current branch is pushed without rewriting any existing repository.

- [ ] **Step 3: Create a new Cloudflare Pages project**

Create a Pages project named `nanami-digital-museum`, connect the new GitHub repository, set build command `npm run build`, output directory `dist`, and production branch `main`.

- [ ] **Step 4: Verify the pages.dev preview**

Check the preview URL, TLS, six sections, GLB and image asset responses, mobile layout, reduced motion, and console errors. Do not move `nanamicat.com` yet.

- [ ] **Step 5: Tag the release candidate**

```bash
git tag -a v1.0.0-rc.1 -m "Nanami digital museum release candidate"
git push origin v1.0.0-rc.1
```

## Task 12: Cut Over nanamicat.com and Verify Production

**Files:**
- No source file changes expected

- [ ] **Step 1: Record rollback handles**

Save the old Pages project name, its current production deployment ID, the old domain binding, and the new pages.dev preview URL in the task notes.

- [ ] **Step 2: Move the custom domain**

Detach `nanamicat.com` from the old Pages project only after preview acceptance, then attach it to `nanami-digital-museum`. Wait for Cloudflare certificate and routing status to become active.

- [ ] **Step 3: Run live HTTP checks**

```bash
curl -I https://nanamicat.com/
curl -I https://nanamicat.com/models/nanami.glb
curl -I https://nanamicat.com/posters/nanami-hero.webp
```

Expected: HTTP 200, valid TLS, and appropriate cache/content types.

- [ ] **Step 4: Run production browser smoke tests**

Run the same desktop/mobile/reduced-motion paths against `https://nanamicat.com/`. Verify no human faces, no private metadata exposure, no console errors, and a production revision matching GitHub.

- [ ] **Step 5: Create the final release tag**

```bash
git tag -a v1.0.0 -m "Launch Nanami personal digital museum"
git push origin v1.0.0
```

- [ ] **Step 6: Keep the old deployment available for rollback**

Do not delete the former Pages project or `zdh2333/nanamicat`. If the new production smoke test fails, restore the previous custom-domain binding immediately.

---

## Final Verification Gate

Run in order:

```bash
npm run test:run
npm run audit:assets
npm run build
npm run test:e2e
curl -I https://nanamicat.com/
```

Completion requires all automated checks to pass, direct visual comparison against all six accepted concepts, a recognizable Nanami GLB with the right-angle tail tip, no human faces in public assets, and a live GitHub-backed Cloudflare revision at the custom domain.
