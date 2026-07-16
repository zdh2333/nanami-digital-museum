import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { describe, it } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test')

import {
  buildReadOnlyLibraryUri,
  chooseInventoryCandidates,
  inventoryQuery,
  writePrivateJson,
} from './inventory-photos-library.mjs'

describe('Photos Library inventory candidate selection', () => {
  it('keeps only large local stills with no detected people scene', () => {
    const eligible = {
      uuid: 'eligible', captureDate: '2021-04-01T00:00:00.000Z', width: 1200, height: 1200,
      localState: 1, kind: 0, peopleScene: 0, favorite: 0, aestheticScore: 0.5,
    }

    assert.deepEqual(chooseInventoryCandidates([
      eligible,
      { ...eligible, uuid: 'cloud-only', localState: 0 },
      { ...eligible, uuid: 'video', kind: 1 },
      { ...eligible, uuid: 'people', peopleScene: 1 },
      { ...eligible, uuid: 'narrow', width: 1199 },
      { ...eligible, uuid: 'short', height: 1199 },
    ]), [eligible])
  })

  it('uses the Photos forward relationship and excludes hidden or trashed assets', () => {
    assert.match(inventoryQuery, /LEFT JOIN ZADDITIONALASSETATTRIBUTES AS x\s+ON a\.ZADDITIONALATTRIBUTES = x\.Z_PK/)
    assert.match(inventoryQuery, /a\.ZTRASHEDSTATE = 0/)
    assert.match(inventoryQuery, /a\.ZHIDDEN = 0/)
  })

  it('opens Photos with WAL-aware read-only mode and refuses SQL writes', () => {
    const uri = buildReadOnlyLibraryUri(join(tmpdir(), 'Photos Library.photoslibrary', 'database', 'Photos.sqlite'))

    assert.match(uri, /^file:/)
    assert.match(uri, /mode=ro/)
    assert.doesNotMatch(uri, /immutable/)
    assert.match(inventoryQuery, /^\s*PRAGMA query_only=ON;/)
  })

  it('atomically replaces a permissive destination with a private mode', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nanami-private-output-'))
    const destination = join(directory, 'inventory.json')
    try {
      await writeFile(destination, 'old', { mode: 0o644 })
      await chmod(destination, 0o644)

      await writePrivateJson(destination, [{ uuid: 'private' }])

      assert.equal((await stat(destination)).mode & 0o777, 0o600)
      assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), [{ uuid: 'private' }])
      assert.deepEqual((await readdir(directory)).sort(), ['inventory.json'])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('queries only the approved output fields and contains no host-specific home path', async () => {
    assert.doesNotMatch(inventoryQuery, /Z(?:FILENAME|DIRECTORY|LATITUDE|LONGITUDE|LOCATIONDATA|PERSON)/)
    assert.match(inventoryQuery, /LIMIT 300/)
    const source = await readFile(join(process.cwd(), 'scripts', 'inventory-photos-library.mjs'), 'utf8')
    assert.doesNotMatch(source, /\/Users\//)
  })
})
