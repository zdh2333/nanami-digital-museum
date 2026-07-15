import { NodeIO } from '@gltf-transform/core';
import {
  CatmullRomCurve3,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error('Usage: node scripts/build-nanami-model.mjs <input.glb> <output.glb>');
}

const io = new NodeIO();
const document = await io.read(inputPath);
const root = document.getRoot();
const scene = root.listScenes()[0];
const buffer = root.listBuffers()[0] ?? document.createBuffer('NanamiBuffer');

const coat = root.listMaterials()[0];
coat
  .setName('Nanami short black coat')
  .setBaseColorFactor([0.012, 0.015, 0.018, 1])
  .setBaseColorTexture(null)
  .setMetallicFactor(0)
  .setRoughnessFactor(0.78)
  .setMetallicRoughnessTexture(null)
  .setDoubleSided(false);

const collarMaterial = document
  .createMaterial('Nanami slim red collar')
  .setBaseColorFactor([0.55, 0.012, 0.018, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.46);

const irisMaterial = document
  .createMaterial('Nanami yellow green irises')
  .setBaseColorFactor([0.62, 0.78, 0.12, 1])
  .setEmissiveFactor([0.035, 0.045, 0.004])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.28);

const pupilMaterial = document
  .createMaterial('Nanami pupils')
  .setBaseColorFactor([0.002, 0.002, 0.002, 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.32);

function addGeometry(name, geometry, material, { translation, scale } = {}) {
  const primitive = document.createPrimitive(`${name} primitive`);
  const mesh = document.createMesh(name).addPrimitive(primitive);
  const node = document.createNode(name).setMesh(mesh);

  for (const [semantic, attributeName] of [
    ['POSITION', 'position'],
    ['NORMAL', 'normal'],
    ['TEXCOORD_0', 'uv'],
  ]) {
    const attribute = geometry.getAttribute(attributeName);
    if (!attribute) continue;
    const array = new Float32Array(attribute.array);
    primitive.setAttribute(
      semantic,
      document
        .createAccessor(`${name} ${semantic}`)
        .setType(semantic === 'TEXCOORD_0' ? 'VEC2' : 'VEC3')
        .setArray(array)
        .setBuffer(buffer),
    );
  }

  if (geometry.index) {
    const Source = geometry.index.array.constructor;
    primitive.setIndices(
      document
        .createAccessor(`${name} indices`)
        .setType('SCALAR')
        .setArray(new Source(geometry.index.array))
        .setBuffer(buffer),
    );
  }

  primitive.setMaterial(material);
  if (translation) node.setTranslation(translation);
  if (scale) node.setScale(scale);
  scene.addChild(node);
  geometry.dispose();
  return node;
}

// Meshy exports this cat Y-up, with the face toward positive Z.
addGeometry(
  'Nanami collar',
  new TorusGeometry(0.142, 0.012, 12, 64),
  collarMaterial,
  { translation: [0, 0.20, 0.58], scale: [1, 1.08, 1] },
);

const eyeGeometry = new SphereGeometry(1, 24, 16);
for (const x of [-0.067, 0.067]) {
  addGeometry(
    `Nanami iris ${x < 0 ? 'left' : 'right'}`,
    eyeGeometry.clone(),
    irisMaterial,
    { translation: [x, 0.33, 0.995], scale: [0.037, 0.046, 0.014] },
  );
  addGeometry(
    `Nanami pupil ${x < 0 ? 'left' : 'right'}`,
    eyeGeometry.clone(),
    pupilMaterial,
    { translation: [x, 0.33, 1.007], scale: [0.010, 0.031, 0.006] },
  );
}
eyeGeometry.dispose();

const tailCurve = new CatmullRomCurve3([
  new Vector3(0, -0.405, -0.96),
  new Vector3(0, -0.405, -1.00),
  new Vector3(0, -0.405, -1.04),
  new Vector3(0, -0.38, -1.065),
  new Vector3(0, -0.335, -1.065),
  new Vector3(0, -0.29, -1.065),
]);
addGeometry(
  'Nanami kinked tail',
  new TubeGeometry(tailCurve, 40, 0.018, 10, false),
  coat,
);
addGeometry(
  'Nanami tail tip',
  new SphereGeometry(1, 16, 12),
  coat,
  { translation: [0, -0.29, -1.065], scale: [0.019, 0.019, 0.019] },
);

await io.write(outputPath, document);
