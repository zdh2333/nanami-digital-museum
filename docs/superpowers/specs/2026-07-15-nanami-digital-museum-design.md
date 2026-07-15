# Nanami Personal Digital Museum — Design Specification

Date: 2026-07-15  
Domain: `https://nanamicat.com/`  
Repository owner: `zdh2333`

## 1. Purpose

Build a public, single-page digital museum for Nanami, a living black cat. The site records her current appearance, personality, photographs, memes, and future daily life. It must never imply that Nanami has died or that the project is a memorial for a deceased pet.

The experience adapts the supplied SynapseX reference site's cinematic, black, full-viewport structure. All branding, copy, imagery, interactions, and narrative are rewritten for Nanami. The central animal is a faithful interactive 3D model of Nanami rather than the reference animal.

## 2. Product Principles

1. **Alive and ongoing:** language describes a living archive that continues to grow.
2. **Recognizably Nanami:** the model preserves her black short coat, yellow-green round eyes, large upright ears, slim body, simple red collar, and distinctive approximately 90-degree kink at the tail tip.
3. **Real images anchor the experience:** generated media supports the presentation, but the gallery uses genuine Nanami photographs and memes.
4. **Private by default:** no published image may contain a human face. Public assets must have EXIF metadata removed.
5. **Cinematic but usable:** dramatic motion must not compromise readability, mobile performance, keyboard access, or reduced-motion preferences.

## 3. Approved Art Direction

The approved direction is **Night Life Archive**.

- Deep obsidian and near-black surfaces.
- Low-chroma ink-green ambient light as the single accent family.
- Real color photography used selectively against the dark environment.
- Refined grotesk display typography paired with a monospace interface layer.
- Large, restrained statements rather than dense card grids.
- Organic tracking lines and subtle living-system motion instead of generic neon AI effects.
- Tone: alert, curious, playful, slightly cool, and affectionate; never mournful.

The interaction language retains the reference's mouse-scrubbing, full-screen sections, text scrambling, parallax, and smooth transitions, while replacing its neural-interface story with Nanami's life archive.

## 4. Nanami Character Specification

The approved 2D turnaround defines the downstream 3D identity:

- Domestic shorthair with a complete natural black coat.
- Yellow-green round eyes and a narrow black nose.
- Large upright triangular ears.
- Slim, long-bodied proportions.
- Slim red collar with no oversized tag.
- Tail terminates in a clearly readable, naturally furred, approximately 90-degree right-angle kink. The final short segment must not read as a loose curl, hook, injury, or broken tail.
- No shaved belly patch in the canonical model.
- No clothing, fantasy anatomy, or cartoon styling.

The 3D model will be generated from the approved, metadata-stripped turnaround and supporting metadata-stripped reference photographs. It will be exported as GLB and optimized for the web. Any third-party upload of the cat imagery requires an action-time confirmation naming the service.

## 5. Information Architecture

The single page contains six narrative sections.

### 5.1 First Contact

- Full-viewport interactive 3D Nanami centered in a dark environment.
- Primary statement: `ONE BLACK CAT. MANY MOODS.`
- Nanami lightly follows pointer movement with her gaze and body.
- Drag rotates the model; scroll transitions into the archive.
- The red collar and right-angle tail tip remain visible in the primary pose.

### 5.2 Presence

- Full-viewport real photograph with controlled parallax and tonal overlay.
- Large scrolling statement: `She runs the house.`
- Short copy establishes Nanami as a real member of the household, not a mascot.

### 5.3 Field Notes

- Replaces fake product metrics with character observations.
- Four core identifiers:
  - `YELLOW-GREEN EYES`
  - `RIGHT-ANGLE TAIL`
  - `RED COLLAR`
  - `ZERO CLOSED DOORS`
- Oversized type and sparse technical labeling maintain the reference site's rhythm.

### 5.4 Mood Archive

- Horizontally browsable, motion-aware gallery of real photos and memes.
- Selecting an item opens a large, keyboard-accessible viewer.
- Viewer metadata may include a short caption and a user-approved display date.
- No location, device, original filename, or hidden EXIF data is exposed.

### 5.5 Living Archive

- Three collections: `Photos`, `Memes`, and `3D`.
- Copy: `Three collections. Always growing.`
- Content is driven by structured local data so future additions do not require layout rewrites.

### 5.6 To Be Continued

- Open-ended closing rather than a memorial conclusion.
- Primary line: `Nanami is probably watching you.`
- Shows the archive's last update date and a GitHub archive link if it is appropriate for public viewing.

## 6. Navigation and Interaction

- Fixed translucent navigation adapted from the reference.
- Brand label: `Nanami`.
- Menu links: `About`, `Field Notes`, `Photos`, and `Memes`.
- Primary action: `Explore` rather than an app-download button.
- Desktop pointer movement affects gaze and subtle model orientation.
- Drag rotates the model without trapping vertical page scroll.
- Touch uses one-finger rotation only inside the model interaction zone; normal vertical swiping remains available.
- Text scramble is limited to entrance and hover moments, with stable accessible text in the DOM.
- Gallery supports arrow keys, Escape, visible focus, and swipe gestures.
- `prefers-reduced-motion` disables scrubbing, parallax, scramble, and large 3D reactions while keeping content complete.

## 7. Technical Architecture

### 7.1 Frontend

- React 18, TypeScript, and Vite.
- Tailwind CSS for design tokens and layout utilities.
- Framer Motion for section transitions, scroll transforms, and controlled text effects.
- React Three Fiber and Drei for the GLB model, camera, lights, and interaction.
- No router, database, authentication, or external runtime API in the initial release.

### 7.2 Content Model

Archive items live in typed local data and reference optimized assets.

Each item contains:

- Stable ID.
- Type: `photo` or `meme`.
- Public asset path.
- Short caption.
- Optional display date.
- Alt text.
- Featured flag and display order.

The production asset pipeline strips metadata, converts to web formats, creates responsive sizes, and refuses images marked as containing a human face.

### 7.3 3D Pipeline

1. Use the approved Nanami turnaround plus selected real references.
2. Strip all metadata before upload.
3. Generate a textured model through Meshy image-to-3D or its multi-view workflow.
4. Inspect identity, body proportions, red collar, facial features, and tail-tip kink.
5. Correct or regenerate failures rather than hiding them with camera angles.
6. Export GLB.
7. Optimize geometry, textures, and compression for web delivery.
8. Provide a static poster fallback generated from the accepted model.

### 7.4 Deployment

- Source of truth: a GitHub repository under `zdh2333`.
- Production hosting: Cloudflare Pages.
- Production domain: `nanamicat.com`.
- The production branch triggers automatic Cloudflare builds.
- DNS and domain configuration remain in the user's existing Cloudflare account.

## 8. Privacy and Asset Rules

- Every candidate photo is checked against the Photos library's face analysis and visually reviewed.
- Human faces are prohibited in production assets, including background reflections and screen content.
- Hands or partial bodies without faces are avoided when a clean alternative exists.
- EXIF GPS, timestamps, device metadata, and original filenames are removed before any external upload or public deployment.
- Generated character assets must not introduce people or unrelated animals.
- Original Apple Photos library files are read-only; the project works from exported copies.

## 9. Performance and Fallbacks

- Desktop receives the optimized primary GLB.
- Mobile receives a lower-weight model and reduced texture resolution when necessary.
- WebGL failure shows a high-resolution static Nanami poster without hiding the page content.
- The first viewport prioritizes typography and poster media while the model loads progressively.
- Large images use responsive formats and lazy loading outside the first viewport.
- Motion is paused when the page is backgrounded.
- A visible loading state is used only for the model, not as a full-page blocker.

## 10. Error Handling

- A failed model load falls back to the poster and records a non-blocking console error.
- A missing archive image displays its caption and a neutral placeholder without collapsing layout.
- Unsupported WebGL, low-memory devices, and reduced-motion preferences resolve to deliberate static modes.
- Gallery interactions never depend solely on hover.
- Deployment verification checks the custom domain, TLS, asset caching, and direct-route behavior.

## 11. Verification and Acceptance Criteria

The release is complete only when all of the following are true:

1. The page visually matches the approved Night Life Archive concepts at desktop and mobile widths.
2. The central model is recognizably Nanami and includes the red collar and right-angle tail-tip kink.
3. Pointer, drag, touch, keyboard, and reduced-motion paths work.
4. No production image contains a human face.
5. Public images contain no GPS, device, or original capture metadata.
6. The site builds without TypeScript errors and passes the selected automated checks.
7. Browser smoke tests cover the six sections, navigation, model fallback, and gallery viewer.
8. Production is reachable at `https://nanamicat.com/` with valid TLS.
9. The production deployment corresponds to a committed GitHub revision.
10. Final browser screenshots are visually compared against the accepted section concepts before handoff.

## 12. Out of Scope for the Initial Release

- User accounts, comments, likes, or public uploads.
- A CMS or database-backed admin panel.
- AI-generated captions at runtime.
- E-commerce, donations, subscriptions, or app downloads.
- Automatic publishing directly from Apple Photos.
- Multiple pets or a general-purpose pet profile platform.
