import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const script = join(projectRoot, 'scripts', 'build-share-assets.mjs')
const temporaryDirectories = []

async function outputRoot() {
  const directory = await mkdtemp(join(tmpdir(), 'nanami-share-assets-'))
  temporaryDirectories.push(directory)
  return directory
}

function build(directory) {
  return spawnSync(process.execPath, [script], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', NANAMI_SHARE_OUTPUT_ROOT: directory },
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('share asset builder', () => {
  it('uses only the reviewed favicon and social artwork sources', async () => {
    const source = await readFile(script, 'utf8')
    expect(source).toContain('assets/source/archive/nanami-photo-003.webp')
    expect(source).toContain('public/hero/nanami-cinematic-hero.webp')
    expect(source).not.toMatch(/https?:\/\/|imagegen|openai/i)
  })

  it('builds deterministic, exact-size, metadata-free assets', async () => {
    const firstRoot = await outputRoot()
    const secondRoot = await outputRoot()
    const first = build(firstRoot)
    const second = build(secondRoot)
    expect(first.status, first.stderr).toBe(0)
    expect(second.status, second.stderr).toBe(0)

    const assets = [
      ['favicon.png', 512, 512],
      ['social/nanami-social-card.webp', 1200, 630],
    ]
    for (const [relativePath, width, height] of assets) {
      const firstFile = join(firstRoot, relativePath)
      const secondFile = join(secondRoot, relativePath)
      expect(await readFile(firstFile)).toEqual(await readFile(secondFile))
      const metadata = await sharp(firstFile, { failOn: 'error' }).metadata()
      expect(metadata).toMatchObject({ width, height })
      expect(metadata.exif).toBeUndefined()
      expect(metadata.iptc).toBeUndefined()
      expect(metadata.xmp).toBeUndefined()
    }
  })
})
