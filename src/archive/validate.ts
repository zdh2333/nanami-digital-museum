import type { LocalizedText } from '../i18n/types'
import type {
  ArchiveCollection,
  ArchiveItem,
  ArchiveItemInput,
} from './types'

const archiveCollections = new Set<ArchiveCollection>(['photos', 'memes', 'portraits'])

function isSafeArchivePath(src: unknown, suffix: '-640.webp' | '-1600.webp'): src is string {
  if (typeof src !== 'string') return false
  const size = suffix === '-640.webp' ? '640' : '1600'
  return new RegExp(
    `^/archive/(?:photos|memes)/[a-z0-9]+(?:-[a-z0-9]+)*-${size}\\.webp$`,
  ).test(src)
}

function validateLocalizedText(value: unknown, field: string): asserts value is LocalizedText {
  if (
    typeof value !== 'object' || value === null ||
    typeof (value as Partial<LocalizedText>).en !== 'string' ||
    (value as Partial<LocalizedText>).en?.trim().length === 0
  ) {
    throw new Error(`${field} must include nonblank en text`)
  }
  if (
    typeof (value as Partial<LocalizedText>)['zh-CN'] !== 'string' ||
    (value as Partial<LocalizedText>)['zh-CN']?.trim().length === 0
  ) {
    throw new Error(`${field} must include nonblank zh-CN text`)
  }
}

function isRealISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (month < 1 || month > 12 || day < 1) return false
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysPerMonth[month - 1]
}

function freezeLocalizedText(value: LocalizedText): LocalizedText {
  return Object.freeze({ en: value.en, 'zh-CN': value['zh-CN'] })
}

export function validateArchive(items: readonly ArchiveItemInput[]): readonly ArchiveItem[] {
  const ids = new Set<string>()
  const validatedItems: ArchiveItem[] = []

  for (const item of items) {
    if (typeof item.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id)) {
      throw new Error('Archive item ID must be a non-empty lowercase slug')
    }
    if (ids.has(item.id)) throw new Error(`Duplicate archive ID: ${item.id}`)
    ids.add(item.id)

    if (item.type !== 'photo' && item.type !== 'meme') {
      throw new Error(`Archive item "${item.id}" has an invalid type`)
    }

    if (!Array.isArray(item.collections) || item.collections.length === 0) {
      throw new Error(`Archive item "${item.id}" must include a collection`)
    }
    const memberships = item.collections as readonly ArchiveCollection[]
    if (
      new Set(memberships).size !== memberships.length ||
      memberships.some((collection) => !archiveCollections.has(collection))
    ) {
      throw new Error(`Archive item "${item.id}" has invalid or duplicate collection memberships`)
    }
    if (item.type === 'photo' && !memberships.includes('photos')) {
      throw new Error(`Archive photo "${item.id}" must belong to photos`)
    }
    if (item.type === 'photo' && memberships.includes('memes')) {
      throw new Error(`Archive photo "${item.id}" has contradictory collection memberships`)
    }
    if (item.type === 'meme' && !memberships.includes('memes')) {
      throw new Error(`Archive meme "${item.id}" must belong to memes`)
    }
    if (item.type === 'meme' &&
      (memberships.includes('photos') || memberships.includes('portraits'))) {
      throw new Error(`Archive meme "${item.id}" has contradictory collection memberships`)
    }

    if (!isSafeArchivePath(item.src640, '-640.webp')) {
      throw new Error(`Archive item "${item.id}" must use a safe 640 public /archive/ path`)
    }
    if (!isSafeArchivePath(item.src1600, '-1600.webp')) {
      throw new Error(`Archive item "${item.id}" must use a safe 1600 public /archive/ path`)
    }
    if (item.src640.slice(0, -'-640.webp'.length) !== item.src1600.slice(0, -'-1600.webp'.length)) {
      throw new Error(`Archive item "${item.id}" must use a matching responsive source pair`)
    }

    validateLocalizedText(item.caption, `Archive item "${item.id}" caption`)
    validateLocalizedText(item.alt, `Archive item "${item.id}" alt`)
    validateLocalizedText(item.story, `Archive item "${item.id}" story`)
    if (item.location !== undefined) {
      validateLocalizedText(item.location, `Archive item "${item.id}" location`)
    }
    if (item.captureDate !== undefined &&
      (typeof item.captureDate !== 'string' || !isRealISODate(item.captureDate))) {
      throw new Error(`Archive item "${item.id}" has an invalid capture date`)
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

    validatedItems.push(Object.freeze({
      ...item,
      collections: Object.freeze([...memberships]),
      caption: freezeLocalizedText(item.caption),
      alt: freezeLocalizedText(item.alt),
      story: freezeLocalizedText(item.story),
      ...(item.location === undefined
        ? {}
        : { location: freezeLocalizedText(item.location) }),
      faceChecked: true as const,
    }))
  }

  return Object.freeze(validatedItems)
}
