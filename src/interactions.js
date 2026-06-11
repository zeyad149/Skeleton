import * as THREE from 'three';
import { highlightPart, clearHighlight } from './anatomy.js';

/**
 * Click / tap to highlight and label any bone.
 *
 * - Distinguishes a click from an orbit-drag (pointer must not travel far).
 * - Raycasts against catalogued meshes, highlights the hit part, and shows a
 *   bilingual (English + Arabic) label anchored to the part in screen space.
 * - Clicking empty space clears the selection.
 *
 * The label element follows the part each frame via `update()`.
 */
export function createPicker({ renderer, camera, registry, labelEl }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const meshes = registry.parts.map((p) => p.mesh);

  let selected = null;
  const anchor = new THREE.Vector3();

  let downX = 0;
  let downY = 0;
  let downTime = 0;

  const el = renderer.domElement;

  el.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  });

  el.addEventListener('pointerup', (e) => {
    // Ignore if this was a drag (orbit) rather than a tap.
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    const elapsed = performance.now() - downTime;
    if (moved > 6 || elapsed > 600) return;

    const rect = el.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length === 0) {
      select(null);
      return;
    }
    const entry = hits[0].object.userData.anatomy;
    select(entry || null);
  });

  function select(entry) {
    if (selected === entry) {
      // Toggle off when clicking the same part again.
      select(null);
      return;
    }
    if (selected) clearHighlight(selected);
    selected = entry;
    if (!selected) {
      hideLabel();
      return;
    }
    highlightPart(selected);
    showLabel(selected);
  }

  function showLabel(entry) {
    labelEl.querySelector('.label__en').textContent = entry.label.en;
    labelEl.querySelector('.label__ar').textContent = entry.label.ar;
    labelEl.classList.add('is-visible');
  }
  function hideLabel() {
    labelEl.classList.remove('is-visible');
  }

  // Keep the label pinned to the selected part as the camera moves.
  function update() {
    if (!selected) return;
    new THREE.Box3().setFromObject(selected.mesh).getCenter(anchor);
    const projected = anchor.clone().project(camera);

    // Hide the label if the part is behind the camera.
    if (projected.z > 1) {
      labelEl.classList.remove('is-visible');
      return;
    }
    labelEl.classList.add('is-visible');

    const rect = renderer.domElement.getBoundingClientRect();
    const x = (projected.x * 0.5 + 0.5) * rect.width;
    const y = (-projected.y * 0.5 + 0.5) * rect.height;
    labelEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }

  function clear() {
    select(null);
  }

  return { update, clear, getSelected: () => selected };
}
