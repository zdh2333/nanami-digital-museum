import { expect, test, type Page, type TestInfo } from '@playwright/test'

const sectionOrder = [
  'hero',
  'presence',
  'field-notes',
  'mood-archive',
  'living-archive',
  'closing',
] as const

const heroAlt =
  'Nanami, a black cat, sitting in a dark room and looking directly at the camera.'

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

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
}

async function expectVisibleControlsMeetTouchTarget(page: Page) {
  const undersized = await page.locator('button, a[href]').evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const element = node as HTMLElement
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (!rect.width || !rect.height || style.visibility === 'hidden') return []
      return rect.width < 44 || rect.height < 44
        ? [{
            label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }]
        : []
    }),
  )
  expect(undersized).toEqual([])
}

async function switchToChinese(page: Page) {
  const desktopLanguage = page.getByRole('button', { name: '中文' })
  if (await desktopLanguage.isVisible()) {
    await desktopLanguage.click()
    return
  }

  await page.getByRole('button', { name: 'Menu' }).tap()
  await page.getByRole('dialog', { name: 'Museum navigation' }).getByRole('button', { name: '中文' }).tap()
  await page.keyboard.press('Escape')
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

test('keeps both locales free of runtime failures, overlays, and legacy 3D', async ({ page }) => {
  const failures = collectRuntimeFailures(page)
  const legacyRequests: string[] = []
  page.on('request', (request) => {
    if (/\.(?:glb|gltf)(?:[?#]|$)|\/models\//i.test(request.url())) {
      legacyRequests.push(request.url())
    }
  })

  await page.goto('/')
  await waitForImage(page.getByRole('img', { name: heroAlt }))
  await expect(page.locator('vite-error-overlay, nextjs-portal, [data-nextjs-dialog-overlay]')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await switchToChinese(page)
  await expect(page.getByRole('heading', { name: '一只黑猫。 无数种表情。' })).toBeVisible()
  await waitForImage(page.getByRole('img', { name: '黑猫七海坐在昏暗的房间里，直接看向镜头。' }))
  await expectNoHorizontalOverflow(page)
  expect(legacyRequests).toEqual([])
  expect(failures).toEqual([])
})

test.describe('desktop museum', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop-only coverage')
  })

  test('has exact copy, clean runtime, and no horizontal overflow', async ({ page }) => {
    const failures = collectRuntimeFailures(page)
    await page.goto('/')
    await waitForImage(page.getByRole('img', { name: heroAlt }))

    await expect(page.getByRole('heading', { name: 'ONE BLACK CAT. MANY MOODS.' })).toBeVisible()
    await expect(page.getByText('Cinematic portrait', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'He runs the house.' })).toBeAttached()
    await expect(page.getByText('Right-angle tail tip', { exact: true })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Mood Archive' })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'His story is still unfolding.' })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Nanami is probably watching you.' })).toBeAttached()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
    expect(failures).toEqual([])
  })

  test('keeps localized archival hero metadata visibly present on desktop', async ({ page }, testInfo) => {
    await page.goto('/')

    const hero = page.locator('#hero')
    const metadata = hero.locator('.hero-mobile-copy')
    await waitForImage(hero.getByRole('img', { name: heroAlt }))
    await settleFrames(page, 10)
    await expect(hero.getByRole('heading', { name: 'ONE BLACK CAT. MANY MOODS.' })).toBeVisible()
    await expect(hero.getByText('NNM_000001', { exact: false })).toBeVisible()
    await expect(hero.getByText('Cinematic portrait', { exact: true })).toBeVisible()
    const englishBox = await metadata.boundingBox()
    expect(englishBox).not.toBeNull()
    expect(englishBox?.width).toBeGreaterThanOrEqual(1440 * 0.4)
    expect(englishBox?.width).toBeLessThanOrEqual(1440 * 0.46)
    expect((englishBox?.x ?? 0) + (englishBox?.width ?? 0)).toBeLessThan(1440 * 0.5)
    expect(
      await hero.getByRole('heading', { name: 'ONE BLACK CAT. MANY MOODS.' }).evaluate(
        (node) => Number.parseFloat(getComputedStyle(node).fontSize),
      ),
    ).toBeGreaterThanOrEqual(40)
    await expect(metadata).toHaveCSS('clip', 'auto')
    await page.screenshot({ path: testInfo.outputPath('hero-desktop-en.png') })

    await page.getByRole('button', { name: '中文' }).click()
    await expect(hero.getByRole('heading', { name: '一只黑猫。 无数种表情。' })).toBeVisible()
    await expect(hero.getByText('艺术化肖像', { exact: true })).toBeVisible()
    await waitForImage(hero.getByRole('img', { name: '黑猫七海坐在昏暗的房间里，直接看向镜头。' }))
    expect(
      await hero.getByRole('heading', { name: '一只黑猫。 无数种表情。' }).evaluate(
        (node) => Number.parseFloat(getComputedStyle(node).fontSize),
      ),
    ).toBeGreaterThanOrEqual(40)
    await page.reload()
    await waitForImage(hero.getByRole('img', { name: '黑猫七海坐在昏暗的房间里，直接看向镜头。' }))
    await settleFrames(page, 10)
    await page.screenshot({ path: testInfo.outputPath('hero-desktop-zh.png') })
  })

  test('keyboard navigation scrolls below the fixed header and updates the hash', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: 'Field Notes' })
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

    await page.getByRole('link', { name: 'Profile' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#presence$/)
    await expect(page.locator('#presence')).toBeInViewport()
  })

  test('loads the approved cinematic hero without any legacy 3D requests', async ({ page }) => {
    const modelRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/models/')) modelRequests.push(request.url())
    })
    await page.goto('/')
    const hero = page.getByRole('img', { name: heroAlt })
    await waitForImage(hero)

    await expect(hero).toHaveAttribute('src', '/hero/nanami-cinematic-hero.webp')
    expect(await hero.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(1672)
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByText('Drag to turn', { exact: true })).toHaveCount(0)
    expect(modelRequests).toEqual([])
  })

  test('serves 640 thumbnails and a keyboard-complete 1600 archive viewer', async ({ page }) => {
    const archiveRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/archive/')) archiveRequests.push(request.url())
    })
    await page.goto('/')
    await page.locator('#mood-archive').scrollIntoViewIfNeeded()

    const cards = page.locator('.archive-card')
    await expect(cards).toHaveCount(22)
    const firstThumbnail = cards.first().locator('img')
    await waitForImage(firstThumbnail)
    expect(await firstThumbnail.evaluate((image) => (image as HTMLImageElement).currentSrc)).toMatch(/-640\.webp$/)
    expect(archiveRequests.some((url) => /-1600\.webp$/.test(url))).toBe(false)

    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await expect(cards).toHaveCount(16)
    await page.getByRole('button', { name: 'Memes', exact: true }).click()
    await expect(cards).toHaveCount(6)
    await page.getByRole('button', { name: 'Portraits', exact: true }).click()
    await expect(cards).toHaveCount(3)
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(cards).toHaveCount(22)

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

  test('keeps the same accessible hero without model requests for reduced motion', async ({ page }) => {
    const modelRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/models/')) modelRequests.push(request.url())
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const hero = page.getByRole('img', { name: heroAlt })
    await waitForImage(hero)
    await expect(page.locator('[data-reveal="static"]')).toHaveCount(6)
    await expect(page.locator('[data-reveal="animated"]')).toHaveCount(0)
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(modelRequests).toEqual([])
  })

  test('does not depend on WebGL', async ({ page }) => {
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
    await waitForImage(page.getByRole('img', { name: heroAlt }))
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(modelRequests).toEqual([])
  })

  test('captures six desktop section review artifacts', async ({ page }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== 'desktop')
    await page.goto('/')
    await waitForImage(page.getByRole('img', { name: heroAlt }))
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

  test('keeps localized archival hero metadata visible on mobile', async ({ page }) => {
    await page.goto('/')
    const hero = page.locator('#hero')

    await expect(hero.getByRole('heading', { name: 'ONE BLACK CAT. MANY MOODS.' })).toBeVisible()
    await expect(hero.getByText('NNM_000001', { exact: false })).toBeVisible()
    await expect(hero.getByText('Cinematic portrait', { exact: true })).toBeVisible()
  })

  test('mobile menu navigates to the archive and closes', async ({ page }) => {
    await page.goto('/')
    const menu = page.getByRole('button', { name: 'Menu' })

    await menu.click()
    const dialog = page.getByRole('dialog', { name: 'Museum navigation' })
    await expect(dialog).toBeVisible()

    const archive = dialog.getByRole('link', { name: 'Archive' })
    await archive.focus()
    await page.keyboard.press('Enter')

    await expect(dialog).toBeHidden()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(page).toHaveURL(/#mood-archive$/)
    await expect(page.locator('#mood-archive')).toBeInViewport()

    await menu.tap()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(menu).toBeFocused()
  })

  test('preserves filter URLs across reload, back, and forward', async ({ page }) => {
    await page.goto('/?ref=release#mood-archive')
    await page.locator('#mood-archive').scrollIntoViewIfNeeded()

    await page.getByRole('button', { name: 'Photos', exact: true }).click()
    await expect(page).toHaveURL(/\?ref=release&collection=photos#mood-archive$/)
    await expect(page.locator('.archive-card')).toHaveCount(16)
    await page.getByRole('button', { name: 'Memes', exact: true }).click()
    await expect(page).toHaveURL(/\?ref=release&collection=memes#mood-archive$/)
    await expect(page.locator('.archive-card')).toHaveCount(6)

    await page.goBack()
    await expect(page.getByRole('button', { name: 'Photos', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.archive-card')).toHaveCount(16)
    await page.goForward()
    await expect(page.getByRole('button', { name: 'Memes', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Memes', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.archive-card')).toHaveCount(6)
  })

  test('shows localized viewer metadata and returns focus after touch close', async ({ page }) => {
    await page.goto('/?collection=portraits#mood-archive')
    await page.locator('#mood-archive').scrollIntoViewIfNeeded()
    const opener = page.locator('.archive-card').first()
    await opener.tap()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Date', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Story', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Close' }).tap()
    await expect(dialog).toBeHidden()
    await expect(opener).toBeFocused()

    await page.getByRole('button', { name: 'Menu' }).tap()
    await page.getByRole('dialog', { name: 'Museum navigation' }).getByRole('button', { name: '中文' }).tap()
    await page.keyboard.press('Escape')
    await opener.tap()
    const localizedDialog = page.getByRole('dialog')
    await expect(localizedDialog.getByText('日期', { exact: true })).toBeVisible()
    await expect(localizedDialog.getByText('故事', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
  })

  test('keeps 320px bilingual layout, controls, and reveals release-safe', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 700 })
    const failures = collectRuntimeFailures(page)
    await page.goto('/')
    await waitForImage(page.getByRole('img', { name: heroAlt }))
    await expectNoHorizontalOverflow(page)
    await expectVisibleControlsMeetTouchTarget(page)

    for (const reveal of await page.locator('[data-reveal="animated"]').all()) {
      await reveal.scrollIntoViewIfNeeded()
      await expect(reveal).toBeInViewport()
      await expect(reveal).toHaveCSS('opacity', '1')
    }

    await switchToChinese(page)
    await expect(page.getByRole('heading', { name: '一只黑猫。 无数种表情。' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectVisibleControlsMeetTouchTarget(page)
    expect(failures).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath('mobile-320-zh-full-page.png'),
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('loads, scrolls, navigates, filters, and avoids legacy 3D', async ({ page }, testInfo) => {
    const modelRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/models/')) modelRequests.push(request.url())
    })
    await page.goto('/')
    await waitForImage(page.getByRole('img', { name: heroAlt }))
    await expect(page.getByRole('heading', { name: 'ONE BLACK CAT. MANY MOODS.' })).toBeVisible()
    await expect(page.locator('.hero-mobile-copy p')).toContainText('NNM_000001')
    await expect(page.getByText('Cinematic portrait', { exact: true })).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true)
    expect(modelRequests).toEqual([])
    await expect(page.locator('canvas')).toHaveCount(0)

    const startY = await page.evaluate(() => window.scrollY)
    await page.mouse.wheel(0, 700)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(startY)

    await page.locator('#presence').scrollIntoViewIfNeeded()
    const roomPortrait = page.locator('#presence').getByRole('img', {
      name: 'Nanami standing at the edge of a bed and looking directly at the camera.',
    })
    await waitForImage(roomPortrait)
    await expect(page.locator('.presence__copy')).toHaveCSS('opacity', '1')
    const presenceMedia = page.locator('.presence__media')
    await presenceMedia.scrollIntoViewIfNeeded()
    await expect(presenceMedia).toBeInViewport()
    await expect(presenceMedia).toHaveCSS('opacity', '1')

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
