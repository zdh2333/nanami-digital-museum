import { expect, test, type Page, type TestInfo } from '@playwright/test'

const sectionOrder = [
  'hero',
  'presence',
  'field-notes',
  'mood-archive',
  'living-archive',
  'closing',
] as const

const posterAlt =
  'Nanami, a black cat with yellow-green eyes and a kinked tail tip'

function collectRuntimeFailures(page: Page) {
  const failures: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => failures.push(`page: ${error.message}`))
  page.on('requestfailed', (request) => {
    failures.push(`request: ${request.url()} (${request.failure()?.errorText})`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failures.push(`response: ${response.status()} ${response.url()}`)
    }
  })
  return failures
}

async function waitForImage(image: ReturnType<Page['locator']>) {
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((node) => {
      const element = node as HTMLImageElement
      return element.complete && element.naturalWidth > 0
    }))
    .toBe(true)
}

async function waitForModel(page: Page) {
  const stage = page.locator('.hero-3d-stage')
  await expect(stage).toHaveAttribute('data-model-ready', 'true', { timeout: 30_000 })
  await expect(page.locator('.hero-3d-canvas canvas')).toBeVisible()
  return stage
}

async function settleFrames(page: Page, frames = 5) {
  await page.evaluate((count) => new Promise<void>((resolve) => {
    let remaining = count
    const tick = () => {
      remaining -= 1
      if (remaining <= 0) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), frames)
}

test('presents the six museum chapters in narrative order', async ({ page }) => {
  await page.goto('/')

  const chapters = page.locator('[data-museum-section]')
  await expect(chapters).toHaveCount(6)
  await expect(
    chapters.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-museum-section')),
    ),
  ).resolves.toEqual(sectionOrder)

  for (const id of sectionOrder) {
    const section = page.locator(`#${id}`)
    await section.scrollIntoViewIfNeeded()
    await expect(section).toBeVisible()
  }
  await expect(
    page.getByRole('heading', { name: 'Nanami is probably watching you.' }),
  ).toBeVisible()
})

test.describe('desktop museum', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop-only coverage')
  })

  test('has exact copy, clean runtime, and no horizontal overflow', async ({ page }) => {
    const failures = collectRuntimeFailures(page)
    await page.goto('/')
    await waitForModel(page)

    await expect(page.getByRole('heading', { name: 'ONE BLACK CAT. MANY MOODS.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'She runs the house.' })).toBeAttached()
    await expect(page.getByText('RIGHT-ANGLE TAIL', { exact: true })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'MOOD ARCHIVE' })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Three collections. Always growing.' })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Nanami is probably watching you.' })).toBeAttached()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
    expect(failures).toEqual([])
  })

  test('keyboard navigation scrolls below the fixed header and updates the hash', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Field notes' })
    await link.focus()
    await expect(link).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#field-notes$/)
    await expect
      .poll(() => page.locator('#field-notes').evaluate((node) => Math.round(node.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(80)
    await expect
      .poll(() => page.locator('#field-notes').evaluate((node) => Math.round(node.getBoundingClientRect().top)))
      .toBeLessThanOrEqual(100)

    await page.getByRole('link', { name: 'Presence' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#presence$/)
    await expect(page.locator('#presence')).toBeInViewport()
  })

  test('loads and manipulates the real desktop GLB while hiding the poster', async ({ page }) => {
    const modelResponses: { url: string; status: number }[] = []
    page.on('response', (response) => {
      if (response.url().endsWith('/models/nanami.glb')) {
        modelResponses.push({ url: response.url(), status: response.status() })
      }
    })
    await page.goto('/')
    await waitForModel(page)

    expect(modelResponses).toEqual([
      { url: 'http://127.0.0.1:4173/models/nanami.glb', status: 200 },
    ])
    await expect(page.locator('.hero-poster')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.getByText('Drag to turn', { exact: true })).toBeVisible()

    const interaction = page.getByRole('img', { name: 'Interactive 3D portrait of Nanami' })
    await interaction.focus()
    await expect(interaction).toBeFocused()
    const initialYaw = await interaction.getAttribute('data-interaction-yaw')
    await page.keyboard.press('ArrowRight')
    await expect(interaction).not.toHaveAttribute('data-interaction-yaw', initialYaw ?? '')
    await settleFrames(page)

    const canvas = page.locator('.hero-3d-canvas canvas')
    const beforeDrag = await canvas.screenshot()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.48)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.48, { steps: 5 })
      await page.mouse.up()
    }
    await settleFrames(page)
    const afterDrag = await canvas.screenshot()
    expect(afterDrag.equals(beforeDrag)).toBe(false)
  })

  test('serves 640 thumbnails and a keyboard-complete 1600 archive viewer', async ({ page }) => {
    const archiveRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/archive/')) archiveRequests.push(request.url())
    })
    await page.goto('/')
    await page.locator('#mood-archive').scrollIntoViewIfNeeded()

    const cards = page.locator('.archive-card')
    await expect(cards).toHaveCount(19)
    const firstThumbnail = cards.first().locator('img')
    await waitForImage(firstThumbnail)
    expect(await firstThumbnail.evaluate((image) => (image as HTMLImageElement).currentSrc)).toMatch(/-640\.webp$/)
    expect(archiveRequests.some((url) => /-1600\.webp$/.test(url))).toBe(false)

    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await expect(cards).toHaveCount(13)
    await page.getByRole('button', { name: 'Memes', exact: true }).click()
    await expect(cards).toHaveCount(6)
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(cards).toHaveCount(19)

    const opener = cards.first()
    await opener.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    const fullImage = dialog.locator('img')
    await waitForImage(fullImage)
    expect(await fullImage.getAttribute('src')).toMatch(/-1600\.webp$/)
    const firstCaption = await dialog.getByRole('heading').textContent()
    await page.keyboard.press('ArrowRight')
    await expect(dialog.getByRole('heading')).not.toHaveText(firstCaption ?? '')
    await page.keyboard.press('ArrowLeft')
    await expect(dialog.getByRole('heading')).toHaveText(firstCaption ?? '')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()
  })

  test('uses accessible poster without model requests for reduced motion', async ({ page }) => {
    const modelRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/models/')) modelRequests.push(request.url())
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const poster = page.getByRole('img', { name: posterAlt })
    await waitForImage(poster)
    await expect(page.locator('.hero-3d-canvas')).toHaveCount(0)
    expect(modelRequests).toEqual([])
  })

  test('falls back cleanly when WebGL is unavailable', async ({ page }) => {
    const modelRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/models/')) modelRequests.push(request.url())
    })
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
        return original.call(this, type, ...args as [])
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto('/')
    await waitForImage(page.getByRole('img', { name: posterAlt }))
    await expect(page.locator('.hero-3d-canvas')).toHaveCount(0)
    expect(modelRequests).toEqual([])
  })

  test('captures six desktop section review artifacts', async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== 'desktop')
    await page.goto('/')
    await waitForModel(page)
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' })

    for (const [index, id] of sectionOrder.entries()) {
      const section = page.locator(`#${id}`)
      await section.scrollIntoViewIfNeeded()
      await settleFrames(page, 2)
      await page.screenshot({
        path: testInfo.outputPath(
          `section-${String(index + 1).padStart(2, '0')}-${id}.png`,
        ),
        animations: 'disabled',
      })
    }
  })
})

test.describe('mobile safety', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only coverage')
  })

  test('loads, scrolls, navigates, filters, and uses only the mobile GLB', async ({ page }, testInfo) => {
    const modelRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/models/')) modelRequests.push(request.url())
    })
    await page.goto('/')
    await waitForModel(page)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
    expect(modelRequests.some((url) => url.endsWith('/models/nanami-mobile.glb'))).toBe(true)
    expect(modelRequests.some((url) => url.endsWith('/models/nanami.glb'))).toBe(false)

    const startY = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 700)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(startY)

    await page.getByRole('link', { name: 'Mood archive' }).click()
    await expect(page.locator('#mood-archive')).toBeInViewport()
    await page.getByRole('button', { name: 'Memes', exact: true }).click()
    await expect(page.locator('.archive-card')).toHaveCount(6)

    for (const id of sectionOrder) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded()
      await expect(page.locator(`#${id}`)).toBeVisible()
    }
    await page.screenshot({
      path: testInfo.outputPath('mobile-full-page.png'),
      fullPage: true,
      animations: 'disabled',
    })
  })
})
