import * as THREE from 'three';
import { createStudio } from './scene.js';
import { createBackgrounds } from './backgrounds.js';
import { loadSkeleton } from './loader.js';
import { buildRegistry, setRegionColors, setIsolate } from './anatomy.js';
import { createCameraDirector } from './camera.js';
import { createPicker } from './interactions.js';
import { createSpineRig } from './animation.js';

/**
 * Anatomy Skeleton Studio — Stage 1
 * Scene, studio lighting, color-managed rendering, background toggles,
 * Draco-ready loader with progress bar.
 */

const canvas = document.getElementById('scene');
const { renderer, scene, camera, controls } = createStudio(canvas);
const backgrounds = createBackgrounds(scene, renderer);

// ---------- Loading UI ----------
const loaderEl = document.getElementById('loader');
const fillEl = document.getElementById('loader-fill');
const pctEl = document.getElementById('loader-pct');
const statusEl = document.getElementById('loader-status');

function setProgress(p) {
  const pct = Math.round(THREE.MathUtils.clamp(p, 0, 1) * 100);
  fillEl.style.width = pct + '%';
  pctEl.textContent = pct + '%';
}
function setStatus(text) {
  statusEl.textContent = text || '';
}
function hideLoader() {
  loaderEl.classList.add('is-hidden');
}

// ---------- Load the skeleton ----------
let registry = null;
let director = null;
let picker = null;
let rig = null;

loadSkeleton({ onProgress: setProgress, onStatus: setStatus }).then(
  ({ object, isPlaceholder }) => {
    scene.add(object);

    // Stage 2: catalog every named part into an addressable registry.
    registry = buildRegistry(object, { isPlaceholder });
    console.info('[anatomy] parts catalogued:', registry.summary());
    reportSpine(registry);

    // Stage 3: camera presets + click-to-label picking.
    director = createCameraDirector(camera, controls, object, registry);
    picker = createPicker({
      renderer,
      camera,
      registry,
      labelEl: document.getElementById('label')
    });

    // Stage 4: spine movement rig (flexion/extension/lateral/hinge/tilt).
    object.updateMatrixWorld(true);
    rig = createSpineRig(object, registry);

    // Diagnostics: confirm the model is non-empty and in front of the camera.
    const bbox = new THREE.Box3().setFromObject(object);
    const bsize = bbox.getSize(new THREE.Vector3());
    console.info('[diag] model bounds', {
      min: bbox.min.toArray().map((n) => +n.toFixed(2)),
      max: bbox.max.toArray().map((n) => +n.toFixed(2)),
      size: bsize.toArray().map((n) => +n.toFixed(2)),
      meshes: registry.parts.length,
      visible: object.visible
    });
    if (bsize.length() === 0 || !isFinite(bsize.length())) {
      console.error('[diag] model has empty/invalid bounds — nothing to render.');
    }

    // Snap the camera to a guaranteed framing of whatever loaded.
    frameObject(camera, controls, bbox);

    setProgress(1);
    // Brief pause so the 100% state is visible, then fade the overlay out.
    setTimeout(hideLoader, isPlaceholder ? 250 : 500);
  }
);

// Position the camera so the given bounding box is comfortably in frame.
function frameObject(cam, ctrls, bbox) {
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1.7;
  const dist =
    (maxDim * 0.62) / Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5));
  cam.position.set(center.x, center.y + size.y * 0.05, center.z + dist * 1.15);
  cam.near = Math.max(dist / 100, 0.01);
  cam.far = dist * 10;
  cam.updateProjectionMatrix();
  ctrls.target.copy(center);
  ctrls.update();
}

function reportSpine(reg) {
  const s = reg.summary();
  const el = document.getElementById('spine-readout');
  if (el) {
    el.textContent =
      `Cervical ${s.cervical} · Thoracic ${s.thoracic} · ` +
      `Lumbar ${s.lumbar} · Sacrum ${s.sacrum} · Coccyx ${s.coccyx} · ` +
      `Discs ${s.disc}`;
  }
}

// ---------- Background buttons ----------
document.querySelectorAll('[data-bg]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document
      .querySelectorAll('[data-bg]')
      .forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    backgrounds.set(btn.dataset.bg);
  });
});

// ---------- Stage 2: spine region color-coding toggle ----------
const regionToggle = document.getElementById('region-toggle');
if (regionToggle) {
  regionToggle.addEventListener('click', () => {
    if (!registry) return;
    const on = !regionToggle.classList.contains('is-active');
    regionToggle.classList.toggle('is-active', on);
    setRegionColors(registry, on);
  });
}

// ---------- Stage 3: camera presets ----------
document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!director) return;
    director.go(btn.dataset.view);
  });
});

// ---------- Stage 3: isolate mode (spine + pelvis only) ----------
const isolateToggle = document.getElementById('isolate-toggle');
if (isolateToggle) {
  isolateToggle.addEventListener('click', () => {
    if (!registry) return;
    const on = !isolateToggle.classList.contains('is-active');
    isolateToggle.classList.toggle('is-active', on);
    setIsolate(registry, on);
  });
}

// ---------- Stage 4: movement animations ----------
const playToggle = document.getElementById('play-toggle');
const animReset = document.getElementById('anim-reset');
const speedInput = document.getElementById('speed');
const speedVal = document.getElementById('speed-val');

document.querySelectorAll('[data-move]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!rig) return;
    document
      .querySelectorAll('[data-move]')
      .forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    rig.setMovement(btn.dataset.move);
  });
});

if (playToggle) {
  playToggle.addEventListener('click', () => {
    if (!rig) return;
    const playing = rig.toggle();
    playToggle.textContent = playing ? '❚❚ Pause' : '▶ Play';
    playToggle.classList.toggle('is-active', playing);
  });
}

if (animReset) {
  animReset.addEventListener('click', () => {
    if (!rig) return;
    rig.reset();
    playToggle.textContent = '▶ Play';
    playToggle.classList.remove('is-active');
  });
}

if (speedInput) {
  speedInput.addEventListener('input', () => {
    const s = parseFloat(speedInput.value);
    if (rig) rig.setSpeed(s);
    speedVal.textContent = s.toFixed(1) + '×';
  });
}

// ---------- Hide UI for recording (H) ----------
const ui = document.getElementById('ui');
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    ui.classList.toggle('is-hidden');
  }
});

// ---------- Render loop ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid jumps after tab-out
  controls.update();
  if (rig) rig.update(dt);
  if (director) director.update();
  if (picker) picker.update();
  renderer.render(scene, camera);
});
