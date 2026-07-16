import type { ArchiveCollection, ArchiveFilter, ArchiveItem } from './types'

export const archiveFilters = Object.freeze([
  'all', 'photos', 'memes', 'portraits',
] as const satisfies readonly ArchiveFilter[])

export function isArchiveFilter(value: unknown): value is ArchiveFilter {
  return typeof value === 'string' && archiveFilters.includes(value as ArchiveFilter)
}

export function filterArchive(
  items: readonly ArchiveItem[],
  filter: ArchiveFilter,
): readonly ArchiveItem[] {
  return filter === 'all'
    ? items
    : items.filter(({ collections }) => collections.includes(filter))
}

export function collectionCounts(items: readonly ArchiveItem[]) {
  return Object.freeze({
    all: items.length,
    photos: filterArchive(items, 'photos').length,
    memes: filterArchive(items, 'memes').length,
    portraits: filterArchive(items, 'portraits').length,
  })
}

export function latestCaptureDate(items: readonly ArchiveItem[]): string | undefined {
  return items.reduce<string | undefined>((latest, { captureDate }) =>
    captureDate !== undefined && (latest === undefined || captureDate > latest)
      ? captureDate
      : latest,
  undefined)
}

export function representativeItem(
  items: readonly ArchiveItem[],
  collection: ArchiveCollection,
): ArchiveItem | undefined {
  const selected = filterArchive(items, collection)
  return selected.find(({ featured }) => featured) ?? selected[0]
}
