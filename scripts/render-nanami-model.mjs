import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const [modelArg, reviewArg, posterArg] = process.argv.slice(2);
if (!modelArg || !reviewArg || !posterArg) {
  throw new Error(
    'Usage: node scripts/render-nanami-model.mjs <model.glb> <review.png> <poster.webp>',
  );
}

const modelPath = resolve(modelArg);
const reviewPath = resolve(reviewArg);
const posterPath = resolve(posterArg);
const modelName = basename(modelPath);

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #d9d4cc; }
      canvas { display: block; width: 100%; height: 100%; }
    </style>
    <script type="importmap">
      {"imports":{"three":"https://unpkg.com/three@0.178.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.178.0/examples/jsm/"}}
    </script>
  </head>
  <body>
    <script type="module">
      import * as THREE from 'three';
      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(1);
      renderer.setSize(innerWidth, innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      document.body.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#d9d4cc');
      const camera = new THREE.PerspectiveCamera(31, innerWidth / innerHeight, 0.01, 100);
      camera.up.set(0, 1, 0);

      scene.add(new THREE.HemisphereLight(0xfff6e6, 0x23303d, 2.6));
      const key = new THREE.DirectionalLight(0xfff1dc, 4.3);
      key.position.set(-3, -4, 6);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xc7ddff, 2.5);
      rim.position.set(4, 3, 3);
      scene.add(rim);

      const gltf = await new GLTFLoader().loadAsync('/${modelName}');
      scene.add(gltf.scene);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const diameter = Math.max(size.x, size.y, size.z);
      const distance = diameter * 1.9;

      window.renderAngle = (angle) => {
        const y = center.y + diameter * 0.08;
        const positions = {
          front: [center.x, y, center.z + distance],
          left: [center.x - distance, y, center.z],
          back: [center.x, y, center.z - distance],
          right: [center.x + distance, y, center.z],
        };
        camera.position.set(...positions[angle]);
        camera.lookAt(center.x, center.y + diameter * 0.03, center.z);
        renderer.render(scene, camera);
      };
      window.renderPoster = () => {
        renderer.setSize(innerWidth, innerHeight);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        camera.position.set(center.x, center.y + size.y * 0.08, center.z + size.y * 2.5);
        camera.lookAt(center.x, center.y + size.y * 0.03, center.z);
        renderer.render(scene, camera);
      };
      window.renderAngle('front');
      window.modelReady = true;
    </script>
  </body>
</html>`;

const server = createServer(async (request, response) => {
  try {
    if (request.url === `/${modelName}`) {
      response.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      response.end(await readFile(modelPath));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(html);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});

await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
const { port } = server.address();
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.modelReady === true);

  const angles = ['front', 'left', 'back', 'right'];
  const renders = [];
  for (const angle of angles) {
    await page.evaluate((name) => window.renderAngle(name), angle);
    renders.push(await page.screenshot({ type: 'png' }));
  }

  await sharp({
    create: { width: 1800, height: 1800, channels: 3, background: '#d9d4cc' },
  })
    .composite([
      { input: renders[0], left: 0, top: 0 },
      { input: renders[1], left: 900, top: 0 },
      { input: renders[2], left: 0, top: 900 },
      { input: renders[3], left: 900, top: 900 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(reviewPath);

  await page.setViewportSize({ width: 1080, height: 1440 });
  await page.evaluate(() => window.renderPoster());
  const posterPng = await page.screenshot({ type: 'png' });
  await sharp(posterPng).webp({ quality: 88, effort: 6 }).toFile(posterPath);
} finally {
  await browser.close();
  server.close();
}
