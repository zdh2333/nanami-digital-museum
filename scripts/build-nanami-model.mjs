import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import {
  CatmullRomCurve3,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = resolve(ROOT, "assets/source/nanami-meshy-raw.glb");
const SOURCE_SHA256 =
  "8e2da3db5d045a87faa986a1380748a0a5c63385defe73b6a1e7bff3436a8c1a";
const DESKTOP_PATH = resolve(ROOT, "public/models/nanami.glb");
const MOBILE_PATH = resolve(ROOT, "public/models/nanami-mobile.glb");
const CLI_PATH = resolve(ROOT, "node_modules/@gltf-transform/cli/bin/cli.js");

async function decorateModel(inputPath, outputPath) {
  const io = new NodeIO();
  const document = await io.read(inputPath);
  const root = document.getRoot();
  const scene = root.listScenes()[0];
  const buffer = root.listBuffers()[0] ?? document.createBuffer("NanamiBuffer");

  const coat = root.listMaterials()[0];
  coat
    .setName("Nanami short black coat")
    .setBaseColorFactor([0.012, 0.015, 0.018, 1])
    .setBaseColorTexture(null)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.78)
    .setMetallicRoughnessTexture(null)
    .setDoubleSided(false);

  const collarMaterial = document
    .createMaterial("Nanami slim red collar")
    .setBaseColorFactor([0.55, 0.012, 0.018, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.46);

  const irisMaterial = document
    .createMaterial("Nanami yellow green irises")
    .setBaseColorFactor([0.62, 0.78, 0.12, 1])
    .setEmissiveFactor([0.035, 0.045, 0.004])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.28);

  const pupilMaterial = document
    .createMaterial("Nanami pupils")
    .setBaseColorFactor([0.002, 0.002, 0.002, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.32);

  function addGeometry(name, geometry, material, { translation, scale } = {}) {
    const primitive = document.createPrimitive(`${name} primitive`);
    const mesh = document.createMesh(name).addPrimitive(primitive);
    const node = document.createNode(name).setMesh(mesh);

    for (const [semantic, attributeName] of [
      ["POSITION", "position"],
      ["NORMAL", "normal"],
      ["TEXCOORD_0", "uv"],
    ]) {
      const attribute = geometry.getAttribute(attributeName);
      if (!attribute) continue;
      const array = new Float32Array(attribute.array);
      primitive.setAttribute(
        semantic,
        document
          .createAccessor(`${name} ${semantic}`)
          .setType(semantic === "TEXCOORD_0" ? "VEC2" : "VEC3")
          .setArray(array)
          .setBuffer(buffer),
      );
    }

    if (geometry.index) {
      const Source = geometry.index.array.constructor;
      primitive.setIndices(
        document
          .createAccessor(`${name} indices`)
          .setType("SCALAR")
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
    "Nanami collar",
    new TorusGeometry(0.142, 0.012, 12, 64),
    collarMaterial,
    { translation: [0, 0.2, 0.58], scale: [1, 1.08, 1] },
  );

  const eyeGeometry = new SphereGeometry(1, 24, 16);
  for (const x of [-0.067, 0.067]) {
    addGeometry(
      `Nanami iris ${x < 0 ? "left" : "right"}`,
      eyeGeometry.clone(),
      irisMaterial,
      { translation: [x, 0.33, 0.995], scale: [0.037, 0.046, 0.014] },
    );
    addGeometry(
      `Nanami pupil ${x < 0 ? "left" : "right"}`,
      eyeGeometry.clone(),
      pupilMaterial,
      { translation: [x, 0.33, 1.007], scale: [0.01, 0.031, 0.006] },
    );
  }
  eyeGeometry.dispose();

  const tailCurve = new CatmullRomCurve3([
    new Vector3(0, -0.405, -0.96),
    new Vector3(0, -0.405, -1.0),
    new Vector3(0, -0.405, -1.04),
    new Vector3(0, -0.38, -1.065),
    new Vector3(0, -0.335, -1.065),
    new Vector3(0, -0.29, -1.065),
  ]);
  addGeometry(
    "Nanami kinked tail",
    new TubeGeometry(tailCurve, 40, 0.018, 10, false),
    coat,
  );
  addGeometry("Nanami tail tip", new SphereGeometry(1, 16, 12), coat, {
    translation: [0, -0.29, -1.065],
    scale: [0.019, 0.019, 0.019],
  });

  await io.write(outputPath, document);
}

function runCli(args) {
  execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

const sourceHash = createHash("sha256")
  .update(await readFile(SOURCE_PATH))
  .digest("hex");
if (sourceHash !== SOURCE_SHA256) {
  throw new Error(
    `Pinned source SHA-256 mismatch: expected ${SOURCE_SHA256}, got ${sourceHash}`,
  );
}

await mkdir(dirname(DESKTOP_PATH), { recursive: true });
const workDir = await mkdtemp(resolve(tmpdir(), "nanami-model-build-"));

try {
  const decoratedPath = resolve(workDir, "nanami-decorated.glb");
  const tangentPath = resolve(workDir, "nanami-tangent.glb");
  await decorateModel(SOURCE_PATH, decoratedPath);
  runCli(["tangents", decoratedPath, tangentPath]);

  runCli([
    "optimize",
    tangentPath,
    DESKTOP_PATH,
    "--compress",
    "quantize",
    "--simplify",
    "true",
    "--simplify-ratio",
    "0.35",
    "--simplify-error",
    "0.002",
    "--palette",
    "false",
    "--join",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "2048",
  ]);
  runCli([
    "optimize",
    tangentPath,
    MOBILE_PATH,
    "--compress",
    "quantize",
    "--simplify",
    "true",
    "--simplify-ratio",
    "0.12",
    "--simplify-error",
    "0.006",
    "--palette",
    "false",
    "--join",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "1024",
  ]);

  runCli(["validate", DESKTOP_PATH]);
  runCli(["validate", MOBILE_PATH]);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
