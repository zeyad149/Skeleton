import * as THREE from 'three';

/**
 * Toggleable backgrounds for recording:
 *  - "gradient": neutral dark studio gradient (default, flattering depth)
 *  - "white":    pure white for clean documents/slides
 *  - "green":    solid chroma-key green for compositing
 *
 * The dark gradient is rendered as a fixed full-screen backdrop texture so it
 * stays put behind the orbiting subject.
 */
export function createBackgrounds(scene, renderer) {
  const gradientTexture = makeGradientTexture();

  const modes = {
    gradient: () => {
      scene.background = gradientTexture;
    },
    white: () => {
      scene.background = new THREE.Color(0xffffff);
    },
    green: () => {
      // Standard chroma-key green
      scene.background = new THREE.Color(0x00b140);
    }
  };

  function set(mode) {
    (modes[mode] || modes.gradient)();
  }

  set('gradient');
  return { set };
}

function makeGradientTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(
    size * 0.5,
    size * 0.42,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.75
  );
  g.addColorStop(0, '#23282f');
  g.addColorStop(0.55, '#15181d');
  g.addColorStop(1, '#0a0c0f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
