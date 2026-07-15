import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'nanami-archive-review-'))
  temporaryDirectories.push(directory)
  const sourceRoot = join(directory, 'sources')
  await mkdir(sourceRoot)
  const filename = 'nanami-photo-001.webp'
  const approved = Buffer.from('reviewed bytes')
  await writeFile(join(sourceRoot, filename), approved)
  const manifestPath = join(directory, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify({ [filename]: createHash('sha256').update(approved).digest('hex') }))
  return { directory: sourceRoot, filename, manifestPath }
}

function runBuild(directory, manifestPath) {
  return spawnSync(process.execPath, ['scripts/optimize-archive-assets.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NANAMI_ARCHIVE_SOURCE_ROOT: directory,
      NANAMI_ARCHIVE_MANIFEST: manifestPath,
    },
    encoding: 'utf8',
  })
}

describe('reviewed archive source verification', () => {
  it('rejects replacement bytes even when the approved filename is unchanged', async () => {
    const { directory, filename, manifestPath } = await fixture()
    await writeFile(join(directory, filename), 'replacement bytes')

    const result = runBuild(directory, manifestPath)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/sha-256 mismatch/i)
  })

  it('rejects a symlink in place of an approved regular file', async () => {
    const { directory, filename, manifestPath } = await fixture()
    const target = join(directory, '..', 'target.webp')
    await writeFile(target, 'reviewed bytes')
    await rm(join(directory, filename))
    await symlink(target, join(directory, filename))

    const result = runBuild(directory, manifestPath)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/symbolic link|regular file/i)
  })
})
