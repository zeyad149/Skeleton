import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { makeBoneMaterial } from './materials.js';

/**
 * Path to the real anatomical mesh. Drop your exported file here:
 *   models/skeleton.glb
 * See README.md for exactly which model to download and how to export it.
 */
const MODEL_URL = 'models/skeleton.glb';

// Draco decoder. Default points at the Google CDN (matches three.js docs).
// If your network policy blocks CDNs, vendor the decoder locally and change
// this to a local path — see README "Offline Draco" notes.
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

/**
 * Attempts to load the real skeleton GLB. If it is missing (HTTP 404 / fetch
 * error), falls back to a clearly-marked procedural placeholder so the scene,
 * lighting and color pipeline can still be verified. The placeholder is NOT
 * the deliverable — it disappears the instant a real models/skeleton.glb exists.
 *
 * @returns {Promise<{ object: THREE.Object3D, isPlaceholder: boolean }>}
 */
export function loadSkeleton({ onProgress, onStatus } = {}) {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  return new Promise((resolve) => {
    onStatus?.('Looking for models/skeleton.glb …');

    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'Skeleton';
        normalizeModel(model);
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        onStatus?.('Model loaded.');
        resolve({ object: model, isPlaceholder: false, gltf });
      },
      (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          onProgress?.(evt.loaded / evt.total);
        }
      },
      () => {
        // Model not found — use placeholder so Stage 1 is still verifiable.
        console.warn(
          `[loader] Could not load "${MODEL_URL}". ` +
            'Showing the procedural placeholder. Add the real GLB per README.'
        );
        onStatus?.('No skeleton.glb found — showing placeholder (see README).');
        onProgress?.(1);
        resolve({ object: buildPlaceholder(), isPlaceholder: true });
      }
    );
  });
}

/** Center the model on the origin and scale it to a ~1.7 m standing height. */
function normalizeModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const targetHeight = 1.7;
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  model.scale.setScalar(scale);

  // Re-evaluate after scaling and seat the feet on y = 0.
  const box2 = new THREE.Box3().setFromObject(model);
  const c2 = new THREE.Vector3();
  box2.getCenter(c2);
  model.position.x -= c2.x;
  model.position.z -= c2.z;
  model.position.y -= box2.min.y;
}

/**
 * Procedural placeholder skeleton — intentionally simple, clearly not the real
 * anatomical mesh. Exists only so the studio lighting and rendering pipeline
 * can be confirmed before the GLB is supplied.
 */
function buildPlaceholder() {
  const group = new THREE.Group();
  group.name = 'PlaceholderSkeleton';
  const mat = makeBoneMaterial();

  const add = (geo, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.rotation.z = rz;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Skull
  add(new THREE.SphereGeometry(0.105, 32, 24), 0, 1.62, 0);
  add(new THREE.BoxGeometry(0.12, 0.08, 0.1), 0, 1.52, 0.02);

  // Spine: stack of vertebrae from sacrum up to base of skull
  const vertebraGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.028, 16);
  const discGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.01, 16);
  let y = 0.95;
  for (let i = 0; i < 22; i++) {
    add(vertebraGeo, 0, y, -0.02);
    y += 0.018;
    add(discGeo, 0, y, -0.02);
    y += 0.016;
  }

  // Ribcage hint
  const ribMat = mat;
  for (let i = 0; i < 6; i++) {
    const ry = 1.18 + i * 0.05;
    const r = 0.16 - i * 0.006;
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.008, 8, 24, Math.PI * 1.2),
      ribMat
    );
    torus.position.set(0, ry, 0.02);
    torus.rotation.x = Math.PI / 2;
    torus.rotation.z = Math.PI * 0.4;
    torus.castShadow = true;
    group.add(torus);
    const torus2 = torus.clone();
    torus2.rotation.z = Math.PI - Math.PI * 0.4;
    group.add(torus2);
  }

  // Pelvis
  const pelvis = add(new THREE.TorusGeometry(0.13, 0.04, 12, 24), 0, 0.92, 0);
  pelvis.rotation.x = Math.PI / 2;
  pelvis.scale.set(1, 0.7, 1);

  // Shoulders
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 12), 0, 1.45, 0, 0, Math.PI / 2);

  // Arms
  add(new THREE.CapsuleGeometry(0.022, 0.3, 4, 8), 0.24, 1.28, 0);
  add(new THREE.CapsuleGeometry(0.02, 0.28, 4, 8), 0.27, 0.98, 0);
  add(new THREE.CapsuleGeometry(0.022, 0.3, 4, 8), -0.24, 1.28, 0);
  add(new THREE.CapsuleGeometry(0.02, 0.28, 4, 8), -0.27, 0.98, 0);

  // Legs
  add(new THREE.CapsuleGeometry(0.03, 0.42, 4, 8), 0.08, 0.66, 0);
  add(new THREE.CapsuleGeometry(0.026, 0.4, 4, 8), 0.08, 0.24, 0);
  add(new THREE.CapsuleGeometry(0.03, 0.42, 4, 8), -0.08, 0.66, 0);
  add(new THREE.CapsuleGeometry(0.026, 0.4, 4, 8), -0.08, 0.24, 0);

  // Feet
  add(new THREE.BoxGeometry(0.06, 0.03, 0.14), 0.08, 0.02, 0.04);
  add(new THREE.BoxGeometry(0.06, 0.03, 0.14), -0.08, 0.02, 0.04);

  return group;
}
