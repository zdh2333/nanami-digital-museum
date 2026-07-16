import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const { describe, it } = process.env.VITEST
  ? await import('vitest')
  : await import('node:test')

import { chooseInventoryCandidates, inventoryQuery } from './inventory-photos-library.mjs'

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

  it('queries only the approved output fields and contains no host-specific home path', async () => {
    assert.doesNotMatch(inventoryQuery, /Z(?:FILENAME|DIRECTORY|LATITUDE|LONGITUDE|LOCATIONDATA|PERSON)/)
    assert.match(inventoryQuery, /LIMIT 300/)
    const source = await readFile(join(process.cwd(), 'scripts', 'inventory-photos-library.mjs'), 'utf8')
    assert.doesNotMatch(source, /\/Users\//)
  })
})
