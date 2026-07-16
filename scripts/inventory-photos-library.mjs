import { execFile } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const libraryPath = process.env.NANAMI_PHOTOS_DB ?? join(
  homedir(), 'Pictures', 'Photos Library.photoslibrary', 'database', 'Photos.sqlite',
)
const libraryUrl = pathToFileURL(libraryPath)
libraryUrl.searchParams.set('immutable', '1')
const libraryUri = libraryUrl.href
const outputPath = process.env.NANAMI_PHOTOS_INVENTORY_OUTPUT ?? join(
  projectRoot, '.superpowers', 'private', 'nanami-photo-candidates.json',
)

export function chooseInventoryCandidates(rows) {
  return rows.filter(({ localState, kind, peopleScene, width, height }) => (
    localState > 0 && kind === 0 && peopleScene === 0 && width >= 1200 && height >= 1200
  ))
}

export const inventoryQuery = `
SELECT
  a.ZUUID AS uuid,
  strftime('%Y-%m-%dT%H:%M:%SZ', a.ZDATECREATED + 978307200, 'unixepoch') AS captureDate,
  a.ZWIDTH AS width,
  a.ZHEIGHT AS height,
  a.ZCLOUDLOCALSTATE AS localState,
  a.ZKIND AS kind,
  COALESCE(x.ZHASPEOPLESCENEMIDORGREATERCONFIDENCE, 0) AS peopleScene,
  COALESCE(a.ZFAVORITE, 0) AS favorite,
  COALESCE(a.ZOVERALLAESTHETICSCORE, 0) AS aestheticScore
FROM ZASSET AS a
LEFT JOIN ZADDITIONALASSETATTRIBUTES AS x
  ON a.ZADDITIONALATTRIBUTES = x.Z_PK
WHERE a.ZDATECREATED >= strftime('%s', '2021-04-01') - 978307200
  AND a.ZCLOUDLOCALSTATE > 0
  AND a.ZKIND = 0
  AND a.ZTRASHEDSTATE = 0
  AND a.ZHIDDEN = 0
  AND COALESCE(x.ZHASPEOPLESCENEMIDORGREATERCONFIDENCE, 0) = 0
  AND a.ZWIDTH >= 1200
  AND a.ZHEIGHT >= 1200
ORDER BY favorite DESC, aestheticScore DESC, a.ZDATECREATED ASC
LIMIT 300;
`

async function main() {
  const { stdout } = await execFileAsync('sqlite3', ['-json', libraryUri, inventoryQuery], { maxBuffer: 8 * 1024 * 1024 })
  const candidates = chooseInventoryCandidates(JSON.parse(stdout || '[]'))
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`, { mode: 0o600 })
  await chmod(outputPath, 0o600)
  console.log(`Wrote ${candidates.length} local still-image candidates to the private review area.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
