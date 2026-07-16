import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const outputRoot =
  process.env.NODE_ENV === 'test' && process.env.NANAMI_SHARE_OUTPUT_ROOT
    ? resolve(process.env.NANAMI_SHARE_OUTPUT_ROOT)
    : join(projectRoot, 'public')

const faviconSource = join(projectRoot, 'assets/source/archive/nanami-photo-003.webp')
const socialSource = join(projectRoot, 'public/hero/nanami-cinematic-hero.webp')
const faviconOutput = join(outputRoot, 'favicon.png')
const socialOutput = join(outputRoot, 'social/nanami-social-card.webp')

async function assertOutput(path, width, height) {
  const metadata = await sharp(path, { failOn: 'error' }).metadata()
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`${path} has ${metadata.width}x${metadata.height}; expected ${width}x${height}`)
  }
  const embedded = ['exif', 'iptc', 'xmp'].filter((key) => metadata[key])
  if (embedded.length > 0) {
    throw new Error(`${path} contains forbidden ${embedded.join('/')} metadata`)
  }
}

async function main() {
  await Promise.all([mkdir(dirname(faviconOutput), { recursive: true }), mkdir(dirname(socialOutput), { recursive: true })])

  await sharp(faviconSource, { failOn: 'error' })
    .rotate()
    .resize(512, 512, { fit: 'cover', position: sharp.strategy.attention })
    .png({ compressionLevel: 9 })
    .toFile(faviconOutput)

  await sharp(socialSource, { failOn: 'error' })
    .resize(1200, 630, { fit: 'cover', position: 'centre' })
    .webp({ quality: 88, effort: 6 })
    .toFile(socialOutput)

  await Promise.all([
    assertOutput(faviconOutput, 512, 512),
    assertOutput(socialOutput, 1200, 630),
  ])
  console.log('Built favicon.png (512x512) and social/nanami-social-card.webp (1200x630)')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
