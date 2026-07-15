import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const auditScript = join(projectRoot, 'scripts', 'audit-public-assets.mjs')
const temporaryDirectories: string[] = []

async function createArchiveDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'nanami-archive-audit-'))
  temporaryDirectories.push(directory)
  return directory
}

function runAudit(directory: string) {
  return execFileSync(process.execPath, [auditScript], {
    encoding: 'utf8',
    env: { ...process.env, NANAMI_ARCHIVE_ROOT: directory },
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('public asset privacy audit', () => {
  it('passes deterministically for an empty archive directory', async () => {
    const directory = await createArchiveDirectory()

    expect(runAudit(directory)).toContain('Asset privacy audit passed (0 files checked)')
  })

  it('recursively scans the configured archive directory', async () => {
    const directory = await createArchiveDirectory()
    const nestedDirectory = join(directory, 'nested')
    await mkdir(nestedDirectory)
    const cleanPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    await writeFile(join(nestedDirectory, 'clean.png'), cleanPng)

    expect(runAudit(directory)).toContain('Asset privacy audit passed (1 files checked)')
  })
})
