import * as THREE from 'three';
import { REGIONS } from './anatomy.js';

/**
 * Preset camera framing + smooth animated transitions.
 *
 * Views: anterior (front), sagittal (side), posterior (back), and a lumbar
 * close-up. Positions are derived from the actual loaded geometry (via the
 * registry / scene bounds) so they frame correctly for any model, not just the
 * placeholder.
 */
export function createCameraDirector(camera, controls, root, registry) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = size.y || 1.7;
  // Distance to comfortably fit the standing figure for the current FOV.
  const fitDist =
    (height * 0.62) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));

  // Target the mid-spine / chest area for whole-body views.
  const bodyTarget = new THREE.Vector3(center.x, center.y + height * 0.08, center.z);

  const presets = {
    anterior: {
      position: new THREE.Vector3(center.x, bodyTarget.y, center.z + fitDist),
      target: bodyTarget.clone()
    },
    sagittal: {
      position: new THREE.Vector3(center.x + fitDist, bodyTarget.y, center.z),
      target: bodyTarget.clone()
    },
    posterior: {
      position: new THREE.Vector3(center.x, bodyTarget.y, center.z - fitDist),
      target: bodyTarget.clone()
    },
    lumbar: makeLumbarPreset(registry, center, box, fitDist)
  };

  let anim = null;

  function go(name) {
    const p = presets[name];
    if (!p) return;
    anim = {
      fromPos: camera.position.clone(),
      toPos: p.position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: p.target.clone(),
      start: performance.now(),
      duration: 750
    };
  }

  // Called every frame from the render loop.
  function update() {
    if (!anim) return;
    const t = Math.min((performance.now() - anim.start) / anim.duration, 1);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(anim.fromPos, anim.toPos, e);
    controls.target.lerpVectors(anim.fromTarget, anim.toTarget, e);
    controls.update();
    if (t >= 1) anim = null;
  }

  return { go, update, presets };
}

function makeLumbarPreset(registry, center, box, fitDist) {
  let lumbarCenter = null;

  if (registry) {
    const lumbar = registry.byRegion[REGIONS.LUMBAR];
    if (lumbar && lumbar.length) {
      const b = new THREE.Box3();
      for (const p of lumbar) b.expandByObject(p.mesh);
      lumbarCenter = b.getCenter(new THREE.Vector3());
    }
  }

  // Fallback: ~40% up the figure, where the lumbar spine sits.
  if (!lumbarCenter) {
    lumbarCenter = new THREE.Vector3(
      center.x,
      box.min.y + (box.max.y - box.min.y) * 0.42,
      center.z
    );
  }

  // Close, slightly off-axis (front-left) for a readable 3/4 lumbar view.
  const d = fitDist * 0.34;
  return {
    position: new THREE.Vector3(
      lumbarCenter.x - d * 0.45,
      lumbarCenter.y + d * 0.12,
      lumbarCenter.z + d * 0.9
    ),
    target: lumbarCenter.clone()
  };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
