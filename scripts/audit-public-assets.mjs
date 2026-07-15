import { lstat, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import exifr from 'exifr'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const archiveRoot =
  process.env.NODE_ENV === 'test' && process.env.NANAMI_ARCHIVE_ROOT
    ? resolve(process.env.NANAMI_ARCHIVE_ROOT)
    : join(projectRoot, 'public', 'archive')
const forbiddenKeys = new Set([
  'latitude',
  'longitude',
  'gpslatitude',
  'gpslongitude',
  'make',
  'model',
  'datetimeoriginal',
  'createdate',
])

async function collectFiles(directory) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
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

function findForbiddenMetadata(value, path = '') {
  if (!value || typeof value !== 'object') return []

  const matches = []
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    const childPath = path ? `${path}.${key}` : key
    if (forbiddenKeys.has(normalizedKey)) matches.push(childPath)
    if (child && typeof child === 'object' && !(child instanceof Date)) {
      matches.push(...findForbiddenMetadata(child, childPath))
    }
  }
  return matches
}

async function main() {
  const files = await collectFiles(archiveRoot)
  const violations = []

  for (const file of files) {
    const metadata = await exifr.parse(file, {
      tiff: true,
      xmp: true,
      iptc: true,
      mergeOutput: true,
      silentErrors: true,
    })
    const exposed = findForbiddenMetadata(metadata)
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
