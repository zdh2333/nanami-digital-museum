import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const auditScript = join(projectRoot, 'scripts', 'audit-public-assets.mjs')
const temporaryDirectories: string[] = []

async function createArchiveDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'nanami-archive-audit-'))
  temporaryDirectories.push(directory)
  return directory
}

function runAudit(directory: string) {
  return spawnSync(process.execPath, [auditScript], {
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

    const result = runAudit(directory)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Asset privacy audit passed (0 files checked)')
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

    const result = runAudit(directory)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Asset privacy audit passed (1 files checked)')
  })

  it('fails when the configured archive root is missing', async () => {
    const directory = await createArchiveDirectory()
    const missingDirectory = join(directory, 'missing')

    const result = runAudit(missingDirectory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/archive.*does not exist/i)
    expect(result.stdout).not.toContain('Asset privacy audit passed')
  })

  it.each([
    ['JPEG', 'corrupt.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00])],
    ['PNG', 'corrupt.png', Buffer.from('89504e470d0a1a0a0000000d', 'hex')],
  ])('fails closed for a truncated %s image', async (_format, filename, contents) => {
    const directory = await createArchiveDirectory()
    await writeFile(join(directory, filename), contents)

    const result = runAudit(directory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/could not be inspected|invalid|corrupt/i)
    expect(result.stdout).not.toContain('Asset privacy audit passed')
  })

  it('rejects identifying EXIF metadata beyond location and camera model', async () => {
    const directory = await createArchiveDirectory()
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#000000' },
    })
      .jpeg()
      .withExif({
        IFD0: {
          Software: 'Personal Photo Workflow',
          ModifyDate: '2026:07:15 12:34:56',
        },
      })
      .toBuffer()
    await writeFile(join(directory, 'identifying-metadata.jpg'), image)

    const result = runAudit(directory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/Software|ModifyDate/)
    expect(result.stdout).not.toContain('Asset privacy audit passed')
  })

  it('rejects identifying XMP owner and timestamp metadata', async () => {
    const directory = await createArchiveDirectory()
    const xmp = `<?xpacket begin=""?>
      <x:xmpmeta xmlns:x="adobe:ns:meta/">
        <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
          <rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/"
            xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
            xmp:CreateDate="2026-07-15T12:34:56+09:00"
            photoshop:AuthorsPosition="Nanami's owner" />
        </rdf:RDF>
      </x:xmpmeta>
    <?xpacket end="w"?>`
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#000000' },
    })
      .png()
      .withXmp(xmp)
      .toBuffer()
    await writeFile(join(directory, 'identifying-metadata.png'), image)

    const result = runAudit(directory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/XMP metadata/)
    expect(result.stdout).not.toContain('Asset privacy audit passed')
  })

  it.each(['jpeg', 'png', 'webp'] as const)(
    'accepts a clean stripped %s image',
    async (format) => {
      const directory = await createArchiveDirectory()
      const image = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#000000' },
      })
        [format]()
        .toBuffer()
      await writeFile(join(directory, `clean.${format === 'jpeg' ? 'jpg' : format}`), image)

      const result = runAudit(directory)

      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Asset privacy audit passed (1 files checked)')
    },
  )

  it('rejects symlinks without following them outside the archive root', async () => {
    const directory = await createArchiveDirectory()
    const outsideFile = join(dirname(directory), `${Date.now()}-outside.jpg`)
    temporaryDirectories.push(outsideFile)
    await writeFile(outsideFile, Buffer.from([0xff, 0xd8, 0xff]))
    await symlink(outsideFile, join(directory, 'linked.jpg'))

    const result = runAudit(directory)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/symlinks are not allowed/i)
    expect(result.stdout).not.toContain('Asset privacy audit passed')
  })
})
