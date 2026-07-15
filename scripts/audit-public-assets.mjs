import { lstat, readdir } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import exifr from 'exifr'
import sharp from 'sharp'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const archiveRoot =
  process.env.NODE_ENV === 'test' && process.env.NANAMI_ARCHIVE_ROOT
    ? resolve(process.env.NANAMI_ARCHIVE_ROOT)
    : join(projectRoot, 'public', 'archive')
const supportedExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp'])

async function collectFiles(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Archive root does not exist: ${directory}`)
    }
    throw error
  }

  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name)
    const stats = await lstat(path)
    if (stats.isSymbolicLink()) {
      throw new Error(`Symlinks are not allowed in public/archive: ${relative(archiveRoot, path)}`)
    }
    if (stats.isDirectory()) files.push(...(await collectFiles(path)))
    else if (stats.isFile() && entry.name !== '.gitkeep') files.push(path)
  }
  return files
}

function metadataKeys(value) {
  if (!value || typeof value !== 'object') return []
  return Object.keys(value).sort((a, b) => a.localeCompare(b))
}

async function inspectImage(file) {
  const extension = extname(file).toLowerCase()
  if (!supportedExtensions.has(extension)) {
    throw new Error(`Unsupported public archive asset format: ${relative(archiveRoot, file)}`)
  }

  let metadata
  try {
    metadata = await sharp(file, { failOn: 'error' }).metadata()
    await sharp(file, { failOn: 'error' }).raw().toBuffer()
  } catch {
    throw new Error(
      `Image could not be inspected because it is invalid or corrupt: ${relative(archiveRoot, file)}`,
    )
  }

  const embeddedBlocks = [
    metadata.exif && 'EXIF',
    metadata.iptc && 'IPTC',
    metadata.xmp && 'XMP',
  ].filter(Boolean)

  if (embeddedBlocks.length === 0) return []

  let parsedMetadata
  try {
    parsedMetadata = await exifr.parse(file, {
      tiff: true,
      xmp: true,
      iptc: true,
      mergeOutput: true,
      silentErrors: false,
    })
  } catch {
    // The privacy-bearing block itself is enough to fail closed even if exifr
    // cannot decode a format or malformed metadata payload.
  }

  const keys = metadataKeys(parsedMetadata)
  const keySummary = keys.length > 0 ? ` (${keys.join(', ')})` : ''
  return [`${embeddedBlocks.join('/')} metadata${keySummary}`]
}

async function main() {
  const files = await collectFiles(archiveRoot)
  const violations = []

  for (const file of files) {
    const exposed = await inspectImage(file)
    if (exposed.length > 0) {
      violations.push(`${relative(projectRoot, file)}: ${exposed.join(', ')}`)
    }
  }

  if (violations.length > 0) {
    throw new Error(`Forbidden image metadata found:\n${violations.join('\n')}`)
  }

  console.log(`Asset privacy audit passed (${files.length} files checked)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
