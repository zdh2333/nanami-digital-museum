import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

const removedPaths = [
  'src/components/Hero3D.tsx',
  'src/components/Hero3D.test.tsx',
  'src/components/NanamiModel.tsx',
  'scripts/build-nanami-model.mjs',
  'scripts/render-nanami-model.mjs',
  'public/models',
  'public/posters/nanami-hero.webp',
  'assets/source/nanami-meshy-raw.glb',
  'assets/source/nanami-meshy-raw.provenance.json',
]

const forbiddenPackageKeys = [
  'model:build',
  'model:browser:install',
  'model:render',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  '@gltf-transform/core',
  '@gltf-transform/cli',
  'playwright',
]

const removedPackages = [
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  '@gltf-transform/core',
  '@gltf-transform/cli',
]

const productionRoots = ['src', 'scripts', 'public', 'assets']
const forbiddenSourcePatterns = [
  /@react-three/,
  /from\s+['"]three['"]/,
  /\/models\//,
  /\.gl(?:b|tf)\b/i,
  /Hero3D/,
  /NanamiModel/,
  /build-nanami-model/,
  /render-nanami-model/,
]

function filesBelow(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? filesBelow(child) : [child]
  })
}

describe('legacy 3D removal', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' })
  }, 30_000)

  it('removes the model pipeline files and source artifacts', () => {
    for (const path of removedPaths) {
      expect(existsSync(join(root, path)), `${path} should not exist`).toBe(false)
    }
  })

  it('removes 3D scripts and direct runtime dependencies', () => {
    const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const packageLock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
    const installed = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }

    for (const key of forbiddenPackageKeys) {
      const section = key.startsWith('model:') ? packageJson.scripts : installed
      expect(section, `${key} should not be declared`).not.toHaveProperty(key)
    }
    expect(packageJson.devDependencies).toHaveProperty('@playwright/test')
    for (const dependency of removedPackages) {
      expect(packageLock.packages).not.toHaveProperty(`node_modules/${dependency}`)
    }
  })

  it('contains no runtime model references in production scopes', () => {
    const files = [join(root, 'package.json')]
    for (const directory of productionRoots) files.push(...filesBelow(join(root, directory)))

    const violations = files.flatMap((file) => {
      if (/\.gl(?:b|tf)$/i.test(file)) return [`${relative(root, file)} is a model asset`]
      if (statSync(file).size > 2_000_000) return []
      const contents = readFileSync(file, 'utf8')
      return forbiddenSourcePatterns
        .filter((pattern) => pattern.test(contents))
        .map((pattern) => `${relative(root, file)} matches ${pattern}`)
    })

    expect(violations).toEqual([])
  })

  it('builds only the approved 2D hero without model payloads or 3D runtime markers', () => {
    const distFiles = filesBelow(join(root, 'dist'))
    expect(distFiles.some((file) => /\.gl(?:b|tf)$/i.test(file))).toBe(false)

    const javascript = distFiles
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    expect(javascript).not.toMatch(/@react-three|THREE\.REVISION|three\.module|\/models\/|\.gl(?:b|tf)\b/i)
    expect(javascript).toContain('/hero/nanami-cinematic-hero.webp')
    expect(javascript).not.toMatch(/<canvas|createElement\(["']canvas/i)
  })
})
