import * as THREE from 'three';
import { makeBoneMaterial, makeDiscMaterial } from './materials.js';

/**
 * Procedural placeholder skeleton — intentionally simple, clearly NOT the real
 * anatomical mesh. It exists only so the studio lighting, the rendering
 * pipeline, AND the per-bone/per-disc features (Stage 2+) can be demonstrated
 * before the real GLB is supplied.
 *
 * The spine is the focus: the full presacral column (7 cervical, 12 thoracic,
 * 5 lumbar) plus the fused sacrum and coccyx, and an intervertebral disc
 * between each adjacent pair — each a SEPARATE, NAMED mesh so it can be
 * colored/labelled/animated independently. Names follow the same convention
 * the real-model registry expects ("Vertebra L4", "Disc L4-L5").
 *
 * A natural sagittal curve (cervical lordosis, thoracic kyphosis, lumbar
 * lordosis) makes it read as a real spine rather than a straight stack.
 */
export function buildPlaceholder() {
  const group = new THREE.Group();
  group.name = 'PlaceholderSkeleton';

  const spine = buildSpine();
  group.add(spine);

  // Coarse body context around the spine (low detail on purpose).
  addBodyContext(group, spine.userData.topY);

  return group;
}

// Sagittal curve: z-offset (forward +) as a function of normalized height t
// (0 = sacrum, 1 = top of cervical). Gentle, anatomically-flavored S-curve.
function sagittalOffset(t) {
  const lumbarLordosis = Math.sin(t * Math.PI * 1.0) * 0.035 * (t < 0.45 ? 1 : 0);
  const thoracicKyphosis = -Math.sin((t - 0.35) * Math.PI * 1.4) * 0.03 * (t > 0.35 && t < 0.8 ? 1 : 0);
  const cervicalLordosis = Math.sin((t - 0.8) * Math.PI * 2.2) * 0.02 * (t > 0.8 ? 1 : 0);
  return lumbarLordosis + thoracicKyphosis + cervicalLordosis;
}

function buildSpine() {
  const spine = new THREE.Group();
  spine.name = 'Spine';
  const boneMat = makeBoneMaterial();
  const discMat = makeDiscMaterial();

  // Ordered list of vertebrae from bottom (sacrum) to top (C1), with a radius
  // that tapers from broad lumbar to slim cervical.
  /** @type {Array<{name: string, code: string, radius: number, height: number}>} */
  const verts = [];

  verts.push({ name: 'Coccyx', code: 'Co', radius: 0.026, height: 0.05 });
  verts.push({ name: 'Sacrum', code: 'S', radius: 0.055, height: 0.09 });
  for (let i = 5; i >= 1; i--) verts.push(lv('L', i, 0.05, 0.03));
  for (let i = 12; i >= 1; i--) verts.push(lv('T', i, 0.043 - (12 - i) * 0.0006, 0.026));
  for (let i = 7; i >= 1; i--) verts.push(lv('C', i, 0.03, 0.018));

  // Lay them out vertically with the sagittal curve.
  let y = 0.92; // sacrum base height
  const total = verts.length;
  let index = 0;
  let prevTopY = null;
  const placed = [];

  for (const v of verts) {
    const t = index / (total - 1);
    const z = sagittalOffset(t);

    const geo = new THREE.CylinderGeometry(v.radius, v.radius * 0.96, v.height, 20);
    const mesh = new THREE.Mesh(geo, boneMat.clone());
    mesh.name = v.name === 'Sacrum' || v.name === 'Coccyx' ? v.name : `Vertebra ${v.code}`;
    mesh.position.set(0, y + v.height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // A small spinous process bump (back of the vertebra) for silhouette.
    if (v.name !== 'Sacrum' && v.name !== 'Coccyx') {
      const proc = new THREE.Mesh(
        new THREE.BoxGeometry(v.radius * 0.5, v.height * 0.6, v.radius * 1.4),
        mesh.material
      );
      proc.position.set(0, 0, -v.radius * 1.1);
      proc.castShadow = true;
      mesh.add(proc);
    }

    spine.add(mesh);
    placed.push({ v, mesh, topY: y + v.height, bottomY: y, z });

    // Disc between this vertebra and the previous one (skip sacrum/coccyx joint).
    if (prevTopY !== null) {
      const prev = placed[placed.length - 2];
      const discMesh = makeDisc(prev, { v, y, z }, discMat);
      if (discMesh) spine.add(discMesh);
    }

    prevTopY = y + v.height;
    y += v.height;
    index++;
  }

  spine.userData.topY = y;
  return spine;
}

function makeDisc(lower, upper, discMat) {
  // Disc names use the two adjacent vertebra codes, e.g. "Disc L4-L5".
  const lowerCode = lower.v.code;
  const upperCode = upper.v.code;
  if (lowerCode === 'Co' || upperCode === 'Co') return null; // no disc at coccyx
  const name =
    lowerCode === 'S' ? `Disc L5-S1` : `Disc ${upperCode}-${lowerCode}`;

  const radius = Math.min(lower.v.radius, upper.v.radius) * 1.02;
  const geo = new THREE.CylinderGeometry(radius, radius, 0.012, 20);
  const disc = new THREE.Mesh(geo, discMat.clone());
  disc.name = name;
  const z = (lower.z + upper.z) / 2;
  disc.position.set(0, lower.topY, z);
  disc.castShadow = true;
  disc.receiveShadow = true;
  disc.userData.isDisc = true;
  return disc;
}

function lv(letter, n, radius, height) {
  return { name: `${letter}${n}`, code: `${letter}${n}`, radius, height };
}

function addBodyContext(group, spineTopY) {
  const mat = makeBoneMaterial();
  const add = (geo, x, y, z, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // Skull
  add(new THREE.SphereGeometry(0.1, 32, 24), 0, spineTopY + 0.1, 0.02, 'Skull');

  // Pelvis (named so the registry/isolate mode can find it)
  const pelvis = add(new THREE.TorusGeometry(0.13, 0.04, 14, 28), 0, 0.92, 0, 'Pelvis');
  pelvis.rotation.x = Math.PI / 2;
  pelvis.scale.set(1, 0.7, 1);

  // Ribcage hint (low detail)
  const ribs = new THREE.Group();
  ribs.name = 'Ribcage';
  for (let i = 0; i < 7; i++) {
    const ry = 1.2 + i * 0.05;
    const r = 0.17 - i * 0.007;
    for (const side of [1, -1]) {
      const rib = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.007, 8, 24, Math.PI * 1.1),
        mat
      );
      rib.position.set(0, ry, 0.02);
      rib.rotation.x = Math.PI / 2;
      rib.rotation.z = side > 0 ? Math.PI * 0.45 : Math.PI - Math.PI * 0.45;
      rib.castShadow = true;
      ribs.add(rib);
    }
  }
  group.add(ribs);

  // Limbs (coarse)
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 12), 0, 1.5, 0.0, 'Clavicles').rotation.z = Math.PI / 2;
  const limb = (x, y, len, r, name) => {
    const m = add(new THREE.CapsuleGeometry(r, len, 4, 8), x, y, 0, name);
    return m;
  };
  limb(0.26, 1.3, 0.3, 0.022, 'Humerus_R');
  limb(0.29, 1.0, 0.28, 0.02, 'Forearm_R');
  limb(-0.26, 1.3, 0.3, 0.022, 'Humerus_L');
  limb(-0.29, 1.0, 0.28, 0.02, 'Forearm_L');
  limb(0.08, 0.66, 0.42, 0.03, 'Femur_R');
  limb(0.08, 0.24, 0.4, 0.026, 'Tibia_R');
  limb(-0.08, 0.66, 0.42, 0.03, 'Femur_L');
  limb(-0.08, 0.24, 0.4, 0.026, 'Tibia_L');
  add(new THREE.BoxGeometry(0.06, 0.03, 0.14), 0.08, 0.02, 0.04, 'Foot_R');
  add(new THREE.BoxGeometry(0.06, 0.03, 0.14), -0.08, 0.02, 0.04, 'Foot_L');
}
