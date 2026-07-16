import { isArchiveFilter } from './collections'
import type { ArchiveFilter } from './types'

export function collectionFromLocation(search: string): ArchiveFilter {
  const collection = new URLSearchParams(search).get('collection')
  return isArchiveFilter(collection) ? collection : 'all'
}

export function collectionUrl(filter: ArchiveFilter, search: string): string {
  const params = new URLSearchParams(search)
  if (filter === 'all') params.delete('collection')
  else params.set('collection', filter)
  const query = params.toString()
  return `${query ? `?${query}` : ''}#mood-archive`
}
