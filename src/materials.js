import * as THREE from 'three';

/**
 * Physically-based bone material with a subtle subsurface / sheen look.
 * Used for the placeholder in Stage 1; real-mesh bones get this in Stage 2.
 */
export function makeBoneMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xeae3d2,
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.5,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xfff6e8),
    sheenRoughness: 0.6,
    // Faint translucency to read as bone rather than plastic
    transmission: 0.04,
    thickness: 0.4,
    ior: 1.35,
    envMapIntensity: 0.5
  });
}

/**
 * Soft, contrasting material for intervertebral discs.
 */
export function makeDiscMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x4fb3c9,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    sheen: 0.2,
    envMapIntensity: 0.6
  });
}
