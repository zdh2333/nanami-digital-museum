import type { ArchiveItemInput } from './types'
import { validateArchive } from './validate'

const archiveSeed: readonly ArchiveItemInput[] = []

export const archiveItems = validateArchive(archiveSeed)
