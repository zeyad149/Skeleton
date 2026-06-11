import * as THREE from 'three';
import { REGIONS } from './anatomy.js';

/**
 * Movement animation engine (Stage 4).
 *
 * Treats the spine as a forward-kinematics chain: an ordered series of joints
 * (hip → L5/S1 → … → C1/C2). Each frame we set a target angle per joint, then
 * walk the chain bottom-to-top composing transforms so each vertebra rotates
 * about the (moving) joint below it. Every other part — skull, ribcage, arms —
 * is a "rider" assigned to the nearest spine level and carried along, so the
 * whole upper body bends believably.
 *
 * Geometry-driven: joint pivots come from the actual rest positions of the
 * loaded meshes, so this works on the procedural placeholder now and on a real
 * separated-bone GLB later, with no per-model tuning.
 *
 * Movements: flexion, extension, lateral flexion, hip hinge, anterior/posterior
 * pelvic tilt. Disc-compression colour: discs redden in proportion to how much
 * the SPINE joint at that disc flexes — so spinal flexion lights the lumbar
 * discs red, while a hip hinge (spine kept neutral) barely colours them, which
 * is exactly the teaching point for lower-back load.
 */

const DEG = Math.PI / 180;
const RED = new THREE.Color(0xff2a2a);
const REF_ANGLE = 11 * DEG; // joint angle that maps to "fully loaded" red

// Per-movement definition. `range` is the headline angle in degrees.
export const MOVEMENTS = {
  flexion: { label: 'Spinal flexion', axis: 'x', range: 64, hip: 0, bidir: false, discScale: 1.0 },
  extension: { label: 'Spinal extension', axis: 'x', range: -28, hip: 0, bidir: false, discScale: 0.8 },
  lateral: { label: 'Lateral flexion', axis: 'z', range: 30, hip: 0, bidir: true, discScale: 0.7 },
  hinge: { label: 'Hip hinge', axis: 'x', range: 8, hip: 68, bidir: false, discScale: 1.0 },
  tilt: { label: 'Pelvic tilt', axis: 'x', range: 4, hip: 13, bidir: true, discScale: 0.5 }
};

// How freely each spine region bends (relative weights for distributing angle).
function regionWeight(region, code) {
  switch (region) {
    case REGIONS.LUMBAR:
      return 3.0;
    case REGIONS.THORACIC: {
      const n = code ? parseInt(code.slice(1), 10) : 6;
      if (n >= 10) return 1.2; // lower thoracic
      if (n >= 5) return 0.5; // mid
      return 0.3; // upper
    }
    case REGIONS.CERVICAL:
      return 0.5;
    default:
      return 0;
  }
}

export function createSpineRig(root, registry) {
  // ----- Capture rest state for every mesh (local to its parent) -----
  const nodes = registry.parts.map((p) => ({
    entry: p,
    mesh: p.mesh,
    restPos: p.mesh.position.clone(),
    restQuat: p.mesh.quaternion.clone(),
    y: worldY(p.mesh),
    level: 0
  }));

  // ----- Hip pivot: centre of pelvis/sacrum, near the femoral heads -----
  const hipPivot = computeHipPivot(registry, root);

  // ----- Ordered movable vertebrae (above the sacrum), ascending Y -----
  const movable = registry.parts
    .filter((p) =>
      [REGIONS.LUMBAR, REGIONS.THORACIC, REGIONS.CERVICAL].includes(p.region)
    )
    .map((p) => ({ entry: p, y: worldY(p.mesh) }))
    .sort((a, b) => a.y - b.y);

  // ----- Build the joint chain: hip first, then each vertebra's lower joint --
  /** @type {Array<{pivot:THREE.Vector3, region:string, code:string|null, weight:number, isHip:boolean}>} */
  const joints = [];
  joints.push({ pivot: hipPivot.clone(), region: 'hip', code: null, weight: 0, isHip: true });

  let prevPos = hipPivot.clone();
  for (const v of movable) {
    const pos = v.entry.mesh.getWorldPosition(new THREE.Vector3());
    const pivot = prevPos.clone().lerp(pos, 0.5); // joint sits between adjacent bones
    joints.push({
      pivot,
      region: v.entry.region,
      code: v.entry.code,
      weight: regionWeight(v.entry.region, v.entry.code),
      isHip: false
    });
    prevPos = pos;
  }

  // Convert joint pivots into root-local space (the space rest positions live in).
  for (const j of joints) root.worldToLocal(j.pivot);

  // Sort joints by height so "level" = number of joints below a node.
  joints.sort((a, b) => a.pivot.y - b.pivot.y);
  const totalSpineWeight = joints.reduce((s, j) => s + j.weight, 0) || 1;

  // ----- Assign every node a level (how many joints sit below it) -----
  for (const n of nodes) {
    const localY = n.restPos.y; // rest positions are parent-local
    let level = 0;
    for (const j of joints) if (j.pivot.y < localY) level++;
    n.level = level;
  }

  // ----- Map each disc to the joint nearest it (for compression colour) -----
  const discNodes = nodes.filter((n) => n.entry.region === REGIONS.DISC);
  for (const d of discNodes) {
    let best = 1;
    let bestDist = Infinity;
    for (let j = 1; j < joints.length; j++) {
      const dist = Math.abs(joints[j].pivot.y - d.restPos.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = j;
      }
    }
    d.jointIndex = best;
  }

  // ----- Playback state -----
  const state = {
    movement: 'flexion',
    playing: false,
    speed: 1.0,
    phase: 0 // 0..1 progress through the oscillation
  };

  const axisVec = { x: new THREE.Vector3(1, 0, 0), z: new THREE.Vector3(0, 0, 1) };
  const jointAngles = new Array(joints.length).fill(0);
  // Accumulated transforms, indexed by LEVEL (0..joints.length). A[k] is the
  // transform for a node with k joints below it; A[0] is the fixed base. Needs
  // joints.length + 1 entries so a node above every joint (level == J) is valid.
  const A = Array.from({ length: joints.length + 1 }, () => ({
    q: new THREE.Quaternion(),
    t: new THREE.Vector3()
  }));

  function setMovement(name) {
    if (!MOVEMENTS[name]) return;
    state.movement = name;
    state.phase = 0;
    apply(); // snap to neutral pose for the new movement
  }
  function play() {
    state.playing = true;
  }
  function pause() {
    state.playing = false;
  }
  function toggle() {
    state.playing = !state.playing;
    return state.playing;
  }
  function setSpeed(s) {
    state.speed = s;
  }
  function reset() {
    state.playing = false;
    state.phase = 0;
    apply();
  }

  // Advance the oscillation and re-pose. dt in seconds.
  function update(dt) {
    if (state.playing) {
      // One full out-and-back cycle every ~4s at 1x speed.
      state.phase += (dt / 4) * state.speed;
      if (state.phase > 1) state.phase -= 1;
    }
    apply();
  }

  function apply() {
    const move = MOVEMENTS[state.movement];

    // Map phase → signed amount in [-1,1] (bidir) or [0,1], eased.
    let amt;
    if (move.bidir) {
      amt = Math.sin(state.phase * Math.PI * 2); // -1 → 1 → -1
    } else {
      // 0 → 1 → 0 with a smooth hold at the extreme
      const tri = 1 - Math.abs(2 * state.phase - 1);
      amt = easeInOut(tri);
    }

    // Distribute the trunk angle across spine joints by weight.
    const trunkAngle = move.range * DEG * amt;
    for (let i = 0; i < joints.length; i++) {
      const j = joints[i];
      if (j.isHip) {
        jointAngles[i] = move.hip * DEG * amt;
      } else {
        jointAngles[i] = trunkAngle * (j.weight / totalSpineWeight);
      }
    }

    // Walk the chain bottom→top, composing transforms about moving pivots.
    // A[0] is identity (the fixed base: legs, feet, ground-side of the hip).
    // A[k] applies joints[0..k-1], so joint[k-1] is the k-th joint from the base.
    A[0].q.identity();
    A[0].t.set(0, 0, 0);
    const r = new THREE.Quaternion();
    const c = new THREE.Vector3();
    const rp = new THREE.Vector3();
    for (let k = 1; k <= joints.length; k++) {
      const j = joints[k - 1];
      // Hip hinge/tilt rotate about X; spine joints use the movement's axis.
      const useAxis = j.isHip ? axisVec.x : move.axis === 'z' ? axisVec.z : axisVec.x;
      r.setFromAxisAngle(useAxis, jointAngles[k - 1]);
      // c = P - r*P
      rp.copy(j.pivot).applyQuaternion(r);
      c.copy(j.pivot).sub(rp);
      // A[k] = A[k-1] ∘ Rot(P, r):  q' = q*r ; t' = q*c + t
      A[k].q.copy(A[k - 1].q).multiply(r);
      A[k].t.copy(c).applyQuaternion(A[k - 1].q).add(A[k - 1].t);
    }

    // Pose every node by its level's accumulated transform.
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (const n of nodes) {
      const a = A[n.level];
      p.copy(n.restPos).applyQuaternion(a.q).add(a.t);
      q.copy(a.q).multiply(n.restQuat);
      n.mesh.position.copy(p);
      n.mesh.quaternion.copy(q);
    }

    // Disc-compression colour: redden ∝ |spine joint angle| at that disc.
    for (const d of discNodes) {
      const mat = d.entry.material;
      if (!mat.color) continue;
      const angle = Math.abs(jointAngles[d.jointIndex] || 0);
      const load = THREE.MathUtils.clamp((angle / REF_ANGLE) * move.discScale, 0, 1);
      mat.color.copy(d.entry.baseColor).lerp(RED, load);
      // A faint emissive bloom sells the "under load" read on video. Only touch
      // emissive under real load so a clicked disc keeps its highlight at rest.
      if (mat.emissive && load > 0.001) {
        mat.emissive.copy(RED).multiplyScalar(load * 0.35);
      }
    }
  }

  return {
    setMovement,
    play,
    pause,
    toggle,
    setSpeed,
    reset,
    update,
    isPlaying: () => state.playing,
    state
  };
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function worldY(mesh) {
  return mesh.getWorldPosition(new THREE.Vector3()).y;
}

function computeHipPivot(registry, root) {
  const box = new THREE.Box3();
  let found = false;
  for (const region of [REGIONS.PELVIS, REGIONS.SACRUM]) {
    for (const p of registry.byRegion[region]) {
      box.expandByObject(p.mesh);
      found = true;
    }
  }
  if (found) {
    const c = box.getCenter(new THREE.Vector3());
    // Drop slightly toward the femoral heads for a natural hinge point.
    c.y = box.min.y + (box.max.y - box.min.y) * 0.35;
    return c;
  }
  // Fallback: a sensible hip height on the model's vertical extent.
  const full = new THREE.Box3().setFromObject(root);
  const c = full.getCenter(new THREE.Vector3());
  c.y = full.min.y + (full.max.y - full.min.y) * 0.52;
  return c;
}
