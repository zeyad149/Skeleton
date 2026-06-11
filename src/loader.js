import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { buildPlaceholder } from './placeholder.js';

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
