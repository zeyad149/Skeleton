import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Builds a broadcast-quality render core:
 *  - Color-managed pipeline (sRGB output + ACES Filmic tone mapping)
 *  - Anti-aliasing, capped high pixel ratio for crisp screen recording
 *  - Soft shadows (PCFSoft) + a subtle shadow-catcher ground
 *  - Studio 3-point lighting (key / fill / rim) + ambient hemisphere
 *  - Image-based lighting (RoomEnvironment) for realistic PBR materials
 */
export function createStudio(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // ----- Color management: professional, video-safe output -----
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // ----- Shadows for realism -----
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  // ----- Camera -----
  const camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0, 1.0, 3.4);

  // ----- Controls: free orbit/pan/zoom (no fixed pivot feel) -----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 0.95, 0);
  // screenSpacePanning lets panning move the pivot anywhere in the view plane,
  // and zoomToCursor zooms toward the pointer — together this gives a "move
  // freely" feel instead of being locked to a centre point. A Reset button in
  // the UI re-frames the model if you drift too far.
  controls.screenSpacePanning = true;
  controls.zoomToCursor = true;
  controls.panSpeed = 1.0;
  controls.minDistance = 0.05;
  controls.maxDistance = 30;
  controls.update();

  // ----- Image-based lighting for PBR reflections -----
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35; // subtle — studio lights do the heavy lifting

  // ----- Studio 3-point lighting -----
  const lights = new THREE.Group();
  lights.name = 'StudioLights';

  // Key light: main soft directional, casts shadow
  const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
  key.position.set(2.2, 3.2, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  const s = key.shadow.camera;
  s.near = 0.5;
  s.far = 12;
  s.left = s.bottom = -2.5;
  s.right = s.top = 2.5;
  lights.add(key);

  // Fill light: cool, soft, no shadow — opens up the dark side
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  fill.position.set(-3.0, 1.6, 1.4);
  lights.add(fill);

  // Rim / back light: separates subject from background
  const rim = new THREE.DirectionalLight(0xffffff, 1.8);
  rim.position.set(-1.4, 2.6, -3.2);
  lights.add(rim);

  // Ambient hemisphere: gentle global lift, grounds color
  const hemi = new THREE.HemisphereLight(0xdfe7ff, 0x2a2622, 0.35);
  lights.add(hemi);

  scene.add(lights);

  // ----- Shadow-catcher ground (invisible except for the soft shadow) -----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  ground.name = 'ShadowCatcher';
  scene.add(ground);

  // ----- Resize handling -----
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, controls, ground };
}
