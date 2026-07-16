import { describe, expect, it } from 'vitest'

import { chooseInventoryCandidates } from './inventory-photos-library.mjs'

describe('Photos Library inventory candidate selection', () => {
  it('keeps only large local stills with no detected people scene', () => {
    const eligible = {
      uuid: 'eligible', captureDate: '2021-04-01T00:00:00.000Z', width: 1200, height: 1200,
      localState: 1, kind: 0, peopleScene: 0, favorite: 0, aestheticScore: 0.5,
    }

    expect(chooseInventoryCandidates([
      eligible,
      { ...eligible, uuid: 'cloud-only', localState: 0 },
      { ...eligible, uuid: 'video', kind: 1 },
      { ...eligible, uuid: 'people', peopleScene: 1 },
      { ...eligible, uuid: 'narrow', width: 1199 },
      { ...eligible, uuid: 'short', height: 1199 },
    ])).toEqual([eligible])
  })
})
