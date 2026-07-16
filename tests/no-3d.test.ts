import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import { TextDecoder } from 'node:util'

import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'

import { App } from '../src/App'
import { LocaleProvider } from '../src/i18n/LocaleProvider'

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

const recursiveProductionRoots = ['src', 'scripts', 'public', 'assets']
const rootEntryAndConfigFiles = [
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'playwright.config.ts',
  'postcss.config.cjs',
  'tailwind.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
]
const forbiddenSourcePatterns = [
  /@react-three(?:\/|\b)/,
  /(?:from\s*|import\s*\()\s*['"]three(?:\/[^'"]*)?['"]/,
  /require\s*\(\s*['"]three(?:\/[^'"]*)?['"]\s*\)/,
  /\bTHREE\./,
  /\bWebGL(?:Renderer|RenderingContext|2RenderingContext)\b/,
  /\bwebgl2?\b/i,
  /getContext\s*\(\s*['"](?:webgl2?|experimental-webgl)['"]/i,
  /<canvas\b/i,
  /(?:createElement|jsx|jsxs)\s*\(\s*(['"`])canvas\1/,
  /\/models(?:\/|\?)/,
  /\.gl(?:b|tf)\b/i,
  /Hero3D/,
  /NanamiModel/,
  /build-nanami-model/,
  /render-nanami-model/,
  /<script\b[^>]*\bsrc\s*=\s*['"]https?:\/\/[^'"]+['"][^>]*>/i,
  /\b(?:import|export)\b[^;\n]*\bfrom\s*['"]https?:\/\//,
  /\bimport\s*\(\s*['"]https?:\/\//,
]
const forbiddenBuiltJavaScriptPatterns = [
  /(['"`])canvas\1/,
]

type ScanSurface = 'source' | 'build-js'

function findForbidden3DReferences(
  contents: string,
  surface: ScanSurface = 'source',
): string[] {
  const patterns = surface === 'build-js'
    ? [...forbiddenSourcePatterns, ...forbiddenBuiltJavaScriptPatterns]
    : forbiddenSourcePatterns

  return patterns
    .filter((pattern) => pattern.test(contents))
    .map((pattern) => String(pattern))
}

function filesBelow(path: string): string[] {
  if (!existsSync(path)) return []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    return entry.isDirectory() ? filesBelow(child) : [child]
  })
}

const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

function decodeTextFile(path: string): string | null {
  let contents: string
  try {
    contents = utf8Decoder.decode(readFileSync(path))
  } catch {
    return null
  }

  if (contents.includes('\0')) return null
  for (const character of contents) {
    const codePoint = character.codePointAt(0) ?? 0
    if (codePoint < 0x20 && !['\t', '\n', '\r', '\f'].includes(character)) {
      return null
    }
  }
  return contents
}

function isProductionTestFile(path: string, base: string): boolean {
  const pathSegments = relative(base, path).split(/[\\/]/)
  return pathSegments.includes('__tests__')
    || /\.(?:test|spec)\.[^/\\]+$/.test(pathSegments.at(-1) ?? '')
}

function scanFiles(
  files: string[],
  base: string,
  options: { build?: boolean; excludeTests?: boolean } = { excludeTests: true },
): string[] {
  return files.flatMap((file) => {
    if (options.excludeTests !== false && isProductionTestFile(file, base)) return []
    if (/\.gl(?:b|tf)$/i.test(file)) return [`${relative(base, file)} is a model asset`]
    const contents = decodeTextFile(file)
    if (contents === null) return []
    return findForbidden3DReferences(
      contents,
      options.build && extname(file).toLowerCase() === '.js'
        ? 'build-js'
        : 'source',
    ).map((pattern) => `${relative(base, file)} matches ${pattern}`)
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
    const files = rootEntryAndConfigFiles.map((file) => join(root, file))
    for (const directory of recursiveProductionRoots) {
      files.push(...filesBelow(join(root, directory)))
    }

    expect(scanFiles(files, root)).toEqual([])
  })

  it('renders the real localized App without a canvas', () => {
    localStorage.setItem('nanami-locale', 'en')
    const { container } = render(
      createElement(LocaleProvider, null, createElement(App)),
    )

    expect(container.querySelector('canvas')).not.toBeInTheDocument()
    expect(screen.getByAltText(
      'Nanami, a black cat, sitting in a dark room and looking directly at the camera.',
    )).toHaveAttribute('src', '/hero/nanami-cinematic-hero.webp')
  })

  it('builds only the approved 2D hero without model payloads or 3D runtime markers', () => {
    const distFiles = filesBelow(join(root, 'dist'))
    expect(distFiles.some((file) => /\.gl(?:b|tf)$/i.test(file))).toBe(false)

    expect(scanFiles(distFiles, root, { build: true, excludeTests: false })).toEqual([])

    const buildText = distFiles
      .map(decodeTextFile)
      .filter((contents): contents is string => contents !== null)
      .join('\n')
    expect(buildText).toContain('/hero/nanami-cinematic-hero.webp')
  })
})

describe('3D reference scanner fixtures', () => {
  const forbiddenSamples = [
    "import { Canvas } from '@react-three/fiber'",
    "import { Scene } from 'three'",
    '<canvas aria-label="interactive cat" />',
    "jsx('canvas', { className: 'hero' })",
    "React.createElement('canvas', null)",
    '<script type="module" src="https://cdn.example.test/three.module.js"></script>',
    "import * as THREE from 'https://cdn.example.test/three.module.js'",
    "import('/runtime/webgl-viewer.js')",
    "fetch('/models/nanami.glb')",
    'const renderer = new WebGLRenderer()',
  ]

  it.each(forbiddenSamples)('rejects forbidden runtime sample %#', (sample) => {
    expect(findForbidden3DReferences(sample)).not.toEqual([])
  })

  it('rejects a canvas literal even when the compiled JSX helper is renamed', () => {
    expect(findForbidden3DReferences("const node = h('canvas', {})", 'build-js'))
      .not.toEqual([])
  })

  it('allows canonical and Open Graph HTTPS metadata', () => {
    const metadata = [
      '<link rel="canonical" href="https://nanami.example.test/">',
      '<meta property="og:image" content="https://nanami.example.test/hero.webp">',
    ].join('\n')

    expect(findForbidden3DReferences(metadata)).toEqual([])
  })

  it('scans safely decodable deployed text regardless of filename extension', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'nanami-no-3d-'))
    try {
      const fixtures = {
        'robots.txt': 'Disallow: /models/nanami.glb',
        'sitemap.xml': '<url><loc>/models/nanami.gltf</loc></url>',
        'icon.svg': '<svg><script>import { Scene } from "three"</script></svg>',
        'site.webmanifest': '{"preview":"/models/nanami.glb"}',
        'runtime-entry': '<script src="https://cdn.example.test/three.js"></script>',
      }
      for (const [name, contents] of Object.entries(fixtures)) {
        writeFileSync(join(fixtureRoot, name), contents)
      }
      writeFileSync(
        join(fixtureRoot, 'binary.webp'),
        Buffer.concat([Buffer.from([0, 255, 0]), Buffer.from('/models/decoy.glb')]),
      )

      const violations = scanFiles(filesBelow(fixtureRoot), fixtureRoot)
      for (const name of Object.keys(fixtures)) {
        expect(violations.some((violation) => violation.startsWith(name)), name).toBe(true)
      }
      expect(violations.some((violation) => violation.startsWith('binary.webp'))).toBe(false)
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })

  it('excludes test and spec files from a production source scan', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'nanami-no-3d-tests-'))
    try {
      mkdirSync(join(fixtureRoot, '__tests__'))
      writeFileSync(join(fixtureRoot, 'Widget.test.tsx'), '<canvas />')
      writeFileSync(join(fixtureRoot, 'Widget.spec.ts'), "import { Scene } from 'three'")
      writeFileSync(join(fixtureRoot, '__tests__', 'helper.ts'), 'new WebGLRenderer()')

      expect(scanFiles(filesBelow(fixtureRoot), fixtureRoot)).toEqual([])
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  })
})
