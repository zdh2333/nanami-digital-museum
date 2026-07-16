import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

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
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
])
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

function isTextFile(path: string): boolean {
  return textExtensions.has(extname(path).toLowerCase())
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

    const violations = files.flatMap((file) => {
      if (/\.gl(?:b|tf)$/i.test(file)) return [`${relative(root, file)} is a model asset`]
      if (!isTextFile(file)) return []
      const contents = readFileSync(file, 'utf8')
      return findForbidden3DReferences(contents)
        .map((pattern) => `${relative(root, file)} matches ${pattern}`)
    })

    expect(violations).toEqual([])
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

    const builtTextFiles = distFiles.filter((file) =>
      ['.html', '.js', '.css'].includes(extname(file).toLowerCase()),
    )
    const violations = builtTextFiles.flatMap((file) =>
      findForbidden3DReferences(
        readFileSync(file, 'utf8'),
        extname(file).toLowerCase() === '.js' ? 'build-js' : 'source',
      )
        .map((pattern) => `${relative(root, file)} matches ${pattern}`),
    )
    expect(violations).toEqual([])

    const buildText = builtTextFiles
      .map((file) => readFileSync(file, 'utf8'))
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
})
