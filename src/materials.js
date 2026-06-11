import * as THREE from 'three';

/**
 * Physically-based bone material with a subtle subsurface / sheen look.
 *
 * Note: we deliberately AVOID `transmission` here. It forces Three.js into a
 * separate transmissive render pass that is costly (works against the 60fps
 * target) and brittle across GPUs/drivers. The soft "not-plastic" bone read is
 * achieved with sheen + a faint warm emissive instead, which is robust and
 * fast. Used for the placeholder and for any untextured real-mesh bones.
 */
export function makeBoneMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xeae3d2,
    roughness: 0.6,
    metalness: 0.0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xfff3e2),
    sheenRoughness: 0.6,
    // Faint warm self-glow fakes shallow subsurface scatter without transmission.
    emissive: new THREE.Color(0x2a2017),
    emissiveIntensity: 0.25,
    envMapIntensity: 0.6
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
    emissive: new THREE.Color(0x000000),
    envMapIntensity: 0.6
  });
}
