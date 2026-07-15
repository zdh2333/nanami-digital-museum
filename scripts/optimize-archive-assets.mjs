import { rm, mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sourceRoot = join(projectRoot, 'assets', 'source', 'archive')
const publicRoot = join(projectRoot, 'public', 'archive')

const memeSpecs = [
  { id: '001', source: 'nanami-photo-006.webp', lines: ['I SAW THAT.'] },
  { id: '002', source: 'nanami-photo-007.webp', lines: ['CLOSED DOOR?', 'UNACCEPTABLE.'] },
  { id: '004', source: 'nanami-photo-012.webp', lines: ['MEETING ADJOURNED.'] },
  { id: '005', source: 'nanami-photo-015.webp', lines: ['YOUR SEAT?', 'INTERESTING.'] },
  { id: '007', source: 'nanami-photo-002.webp', lines: ['HOUSE MANAGER', 'ON DUTY.'] },
  { id: '008', source: 'nanami-photo-001.webp', lines: ['BUSY.', 'TRY LATER.'] },
]

const safeSourceNames = [
  'nanami-photo-001.webp', 'nanami-photo-002.webp', 'nanami-photo-003.webp',
  'nanami-photo-004.webp', 'nanami-photo-005.webp', 'nanami-photo-006.webp',
  'nanami-photo-007.webp', 'nanami-photo-008.webp', 'nanami-photo-009.webp',
  'nanami-photo-012.webp', 'nanami-photo-014.webp', 'nanami-photo-015.webp',
  'nanami-photo-016.webp',
]

const variants = [640, 1600]

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function captionSvg(width, height, lines) {
  const fontSize = Math.round(width * (lines.length === 1 ? 0.064 : 0.056))
  const lineHeight = Math.round(fontSize * 1.12)
  const startY = Math.round(height * 0.82 - ((lines.length - 1) * lineHeight) / 2)
  const spans = lines
    .map((line, index) => `<tspan x="${Math.round(width * 0.07)}" y="${startY + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${Math.round(height * 0.74)}" width="${width}" height="${Math.round(height * 0.26)}" fill="#050806"/>
      <rect x="${Math.round(width * 0.07)}" y="${Math.round(height * 0.775)}" width="${Math.round(width * 0.09)}" height="${Math.max(3, Math.round(width * 0.006))}" fill="#b9ff4a"/>
      <text fill="#f5f6f2" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="${Math.round(fontSize * 0.025)}">${spans}</text>
    </svg>
  `)
}

async function buildPhoto(sourceName, width) {
  const stem = sourceName.replace(/\.webp$/, '')
  await sharp(join(sourceRoot, sourceName), { failOn: 'error' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: width === 640 ? 80 : 84, effort: 6, smartSubsample: true })
    .toFile(join(publicRoot, 'photos', `${stem}-${width}.webp`))
}

async function buildMeme(spec, width) {
  const height = Math.round(width * 1.25)
  const photoHeight = Math.round(height * 0.74)
  const photo = await sharp(join(sourceRoot, spec.source), { failOn: 'error' })
    .rotate()
    .resize({ width, height: photoHeight, fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: width === 640 ? 80 : 84, effort: 6, smartSubsample: true })
    .toBuffer()

  const stem = `nanami-meme-${spec.id}`
  await sharp({
    create: { width, height, channels: 3, background: '#050806' },
  })
    .composite([
      { input: photo, left: 0, top: 0 },
      { input: captionSvg(width, height, spec.lines), left: 0, top: 0 },
    ])
    .webp({ quality: width === 640 ? 80 : 84, effort: 6, smartSubsample: true })
    .toFile(join(publicRoot, 'memes', `${stem}-${width}.webp`))
}

async function main() {
  const sourceNames = (await readdir(sourceRoot))
    .filter((name) => /^nanami-photo-\d{3}\.webp$/.test(name))
    .sort()

  if (sourceNames.join('\n') !== safeSourceNames.join('\n')) {
    throw new Error(`Source masters differ from the privacy-reviewed safe set`)
  }

  await rm(publicRoot, { recursive: true, force: true })
  await mkdir(join(publicRoot, 'photos'), { recursive: true })
  await mkdir(join(publicRoot, 'memes'), { recursive: true })

  for (const sourceName of sourceNames) {
    for (const width of variants) await buildPhoto(sourceName, width)
  }

  for (const spec of memeSpecs) {
    for (const width of variants) await buildMeme(spec, width)
  }

  console.log(`Built ${sourceNames.length * variants.length} photo files and ${memeSpecs.length * variants.length} meme files`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
