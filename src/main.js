import * as THREE from 'three';
import { createStudio } from './scene.js';
import { createBackgrounds } from './backgrounds.js';
import { loadSkeleton } from './loader.js';
import { buildRegistry, setRegionColors } from './anatomy.js';

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

loadSkeleton({ onProgress: setProgress, onStatus: setStatus }).then(
  ({ object, isPlaceholder }) => {
    scene.add(object);

    // Stage 2: catalog every named part into an addressable registry.
    registry = buildRegistry(object, { isPlaceholder });
    console.info('[anatomy] parts catalogued:', registry.summary());

    // Surface the spine breakdown in the UI so per-bone separation is visible.
    reportSpine(registry);

    setProgress(1);
    // Brief pause so the 100% state is visible, then fade the overlay out.
    setTimeout(hideLoader, isPlaceholder ? 250 : 500);
  }
);

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

// ---------- Hide UI for recording (H) ----------
const ui = document.getElementById('ui');
window.addEventListener('keydown', (e) => {
  if (e.key === 'h' || e.key === 'H') {
    ui.classList.toggle('is-hidden');
  }
});

// ---------- Render loop ----------
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
