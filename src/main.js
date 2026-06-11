import * as THREE from 'three';
import { createStudio } from './scene.js';
import { createBackgrounds } from './backgrounds.js';
import { loadSkeleton } from './loader.js';

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
loadSkeleton({ onProgress: setProgress, onStatus: setStatus }).then(
  ({ object, isPlaceholder }) => {
    scene.add(object);
    setProgress(1);
    // Brief pause so the 100% state is visible, then fade the overlay out.
    setTimeout(hideLoader, isPlaceholder ? 250 : 500);
  }
);

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
