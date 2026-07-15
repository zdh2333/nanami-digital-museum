import type { ArchiveItem, ArchiveItemInput } from './types'

function isSafeArchivePath(src: unknown): src is string {
  if (typeof src !== 'string' || !src.startsWith('/archive/')) return false

  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(src)
  } catch {
    return false
  }

  if (
    !decodedPath.startsWith('/archive/') ||
    decodedPath.length === '/archive/'.length ||
    decodedPath.includes('%') ||
    /[\\\0?#]/.test(decodedPath)
  ) {
    return false
  }

  const segments = decodedPath.slice('/archive/'.length).split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

export function validateArchive(items: readonly ArchiveItemInput[]): readonly ArchiveItem[] {
  const ids = new Set<string>()

  for (const item of items) {
    if (typeof item.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) {
      throw new Error('Archive item ID must be a non-empty lowercase slug')
    }
    if (item.type !== 'photo' && item.type !== 'meme') {
      throw new Error(`Archive item "${item.id}" has an invalid type`)
    }
    if (!isSafeArchivePath(item.src)) {
      throw new Error(`Archive item "${item.id}" must use a public /archive/ path`)
    }
    if (typeof item.caption !== 'string' || item.caption.trim().length === 0) {
      throw new Error(`Archive item "${item.id}" must include a caption`)
    }
    if (typeof item.alt !== 'string' || item.alt.trim().length === 0) {
      throw new Error(`Archive item "${item.id}" must include alt text`)
    }
    if (typeof item.featured !== 'boolean') {
      throw new Error(`Archive item "${item.id}" has an invalid featured marker`)
    }
    if (!Number.isInteger(item.order) || item.order < 0) {
      throw new Error(`Archive item "${item.id}" has an invalid order`)
    }
    if (item.faceChecked !== true) {
      throw new Error(`Archive item "${item.id}" has not passed human-face review`)
    }
    if (ids.has(item.id)) {
      throw new Error(`Duplicate archive ID: ${item.id}`)
    }
    ids.add(item.id)
  }

  const validatedItems = items.map((item) =>
    Object.freeze({ ...item }) as ArchiveItem,
  )

  return Object.freeze(validatedItems)
}
