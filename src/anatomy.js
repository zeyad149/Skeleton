import * as THREE from 'three';
import { makeBoneMaterial, makeDiscMaterial } from './materials.js';

/**
 * Anatomy registry — the backbone of per-bone control (Stage 2).
 *
 * After the skeleton loads, we walk the scene graph and build a catalog of
 * every named part. Each entry can be colored, highlighted, faded, or isolated
 * independently — which is exactly what Stages 3 (labels/isolate) and 4
 * (disc-compression color) build on.
 *
 * Spine parts are further classified into regions so we can address, e.g.,
 * "all lumbar vertebrae" or "the L4–L5 disc" by name.
 *
 * Naming: this targets Z-Anatomy / Terminologia Anatomica conventions
 * (e.g. "Vertebra L4", "C1 atlas", "Intervertebral disc L4-L5", "Sacrum"),
 * but the matchers are deliberately loose so most full-skeleton GLBs work.
 */

export const REGIONS = {
  CERVICAL: 'cervical',
  THORACIC: 'thoracic',
  LUMBAR: 'lumbar',
  SACRUM: 'sacrum',
  COCCYX: 'coccyx',
  DISC: 'disc',
  PELVIS: 'pelvis',
  OTHER: 'other'
};

// Canonical bilingual names for spine regions (English + Arabic).
export const REGION_LABELS = {
  [REGIONS.CERVICAL]: { en: 'Cervical spine', ar: 'الفقرات العنقية' },
  [REGIONS.THORACIC]: { en: 'Thoracic spine', ar: 'الفقرات الصدرية' },
  [REGIONS.LUMBAR]: { en: 'Lumbar spine', ar: 'الفقرات القطنية' },
  [REGIONS.SACRUM]: { en: 'Sacrum', ar: 'العجز' },
  [REGIONS.COCCYX]: { en: 'Coccyx', ar: 'العصعص' },
  [REGIONS.DISC]: { en: 'Intervertebral disc', ar: 'القرص الفقري' },
  [REGIONS.PELVIS]: { en: 'Pelvis', ar: 'الحوض' },
  [REGIONS.OTHER]: { en: 'Bone', ar: 'عظم' }
};

// Per-vertebra bilingual region words (for precise labels like "Lumbar
// vertebra L4 / الفقرة القطنية L4").
const VERTEBRA_WORDS = {
  [REGIONS.CERVICAL]: { en: 'Cervical vertebra', ar: 'فقرة عنقية' },
  [REGIONS.THORACIC]: { en: 'Thoracic vertebra', ar: 'فقرة صدرية' },
  [REGIONS.LUMBAR]: { en: 'Lumbar vertebra', ar: 'فقرة قطنية' }
};

// Bilingual names for common non-spine bones, matched loosely by name.
const BONE_NAMES = [
  [/skull|cranium|جمجمة/, { en: 'Skull', ar: 'الجمجمة' }],
  [/mandible|jaw|فك/, { en: 'Mandible', ar: 'الفك السفلي' }],
  [/clavicle|collar|ترقوة/, { en: 'Clavicle', ar: 'الترقوة' }],
  [/scapula|shoulder ?blade|لوح الكتف/, { en: 'Scapula', ar: 'لوح الكتف' }],
  [/sternum|breast ?bone|قص/, { en: 'Sternum', ar: 'عظم القص' }],
  [/\brib|ribcage|costa|ضلع|قفص/, { en: 'Rib', ar: 'ضلع' }],
  [/humerus|عضد/, { en: 'Humerus', ar: 'عظم العضد' }],
  [/radius|كعبرة/, { en: 'Radius', ar: 'الكعبرة' }],
  [/ulna|زند/, { en: 'Ulna', ar: 'الزند' }],
  [/forearm|ساعد/, { en: 'Forearm', ar: 'الساعد' }],
  [/femur|thigh|فخذ/, { en: 'Femur', ar: 'عظم الفخذ' }],
  [/patella|knee ?cap|رضفة/, { en: 'Patella', ar: 'الرضفة' }],
  [/tibia|shin|قصبة/, { en: 'Tibia', ar: 'عظم القصبة' }],
  [/fibula|شظية/, { en: 'Fibula', ar: 'الشظية' }],
  [/\bfoot|tarsal|metatarsal|قدم/, { en: 'Foot', ar: 'القدم' }],
  [/\bhand|carpal|metacarpal|يد/, { en: 'Hand', ar: 'اليد' }]
];

/**
 * Build the precise bilingual label shown when a part is clicked.
 * Falls back to region labels, then to a humanized version of the mesh name.
 */
export function labelFor(entry) {
  const { region, code, name } = entry;

  if (VERTEBRA_WORDS[region] && code) {
    const w = VERTEBRA_WORDS[region];
    return { en: `${w.en} ${code}`, ar: `${w.ar} ${code}` };
  }
  if (region === REGIONS.DISC) {
    const w = REGION_LABELS[REGIONS.DISC];
    return code
      ? { en: `${w.en} ${code}`, ar: `${w.ar} ${code}` }
      : { ...w };
  }
  if (region === REGIONS.SACRUM || region === REGIONS.COCCYX || region === REGIONS.PELVIS) {
    return { ...REGION_LABELS[region] };
  }

  // Non-spine bones by name.
  const lower = (name || '').toLowerCase();
  for (const [re, label] of BONE_NAMES) {
    if (re.test(lower)) return { ...label };
  }

  // Last resort: humanize the raw mesh name.
  const human = (name || 'Bone').replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
  return { en: human || 'Bone', ar: 'عظم' };
}

/**
 * Classify a mesh by its name. Returns { region, code } where code is a short
 * identifier like "L4", "T12", "C1", or "L4-L5" for discs when detectable.
 */
export function classifyByName(rawName) {
  const name = (rawName || '').toLowerCase();

  // Discs first (so "disc l4-l5" isn't mistaken for a lumbar vertebra)
  if (/disc|disque|قرص|intervertebral/.test(name)) {
    const pair = name.match(/([clt]?\s?\d{1,2})\s*[-_/ ]\s*([clst]?\s?\d{1,2})/i);
    const code = pair ? `${clean(pair[1])}-${clean(pair[2])}` : null;
    return { region: REGIONS.DISC, code };
  }

  if (/coccyx|coccyg|tailbone|عصعص/.test(name)) {
    return { region: REGIONS.COCCYX, code: 'Co' };
  }
  if (/sacrum|sacral|عجز/.test(name)) {
    return { region: REGIONS.SACRUM, code: 'S' };
  }

  // Lettered vertebrae: C1..C7, T1..T12 (a.k.a. D1..D12), L1..L5
  const v = name.match(/\b([ctld])\s?-?\s?(\d{1,2})\b/i);
  if (v) {
    const letter = v[1].toUpperCase();
    const num = parseInt(v[2], 10);
    if (letter === 'C' && num >= 1 && num <= 7) {
      return { region: REGIONS.CERVICAL, code: `C${num}` };
    }
    if ((letter === 'T' || letter === 'D') && num >= 1 && num <= 12) {
      return { region: REGIONS.THORACIC, code: `T${num}` };
    }
    if (letter === 'L' && num >= 1 && num <= 5) {
      return { region: REGIONS.LUMBAR, code: `L${num}` };
    }
  }

  // Named cervical specials
  if (/atlas/.test(name)) return { region: REGIONS.CERVICAL, code: 'C1' };
  if (/axis/.test(name)) return { region: REGIONS.CERVICAL, code: 'C2' };

  // Word-based regions
  if (/cervical|عنق/.test(name)) return { region: REGIONS.CERVICAL, code: null };
  if (/thoracic|dorsal|صدر/.test(name)) return { region: REGIONS.THORACIC, code: null };
  if (/lumbar|قطن/.test(name)) return { region: REGIONS.LUMBAR, code: null };

  if (/pelvis|hip|ilium|ischium|pubis|coxa|innominate|حوض/.test(name)) {
    return { region: REGIONS.PELVIS, code: null };
  }

  return { region: REGIONS.OTHER, code: null };
}

function clean(s) {
  return s.replace(/\s+/g, '').toUpperCase();
}

// Distinct colors per spine region, used to visually prove that every part is
// a separately-addressable object (Stage 2 demo; reused as highlight palette).
export const REGION_COLORS = {
  [REGIONS.CERVICAL]: 0x6fd3ff,
  [REGIONS.THORACIC]: 0x8be58b,
  [REGIONS.LUMBAR]: 0xffd166,
  [REGIONS.SACRUM]: 0xff9f6e,
  [REGIONS.COCCYX]: 0xff6f91,
  [REGIONS.DISC]: 0x4fb3c9
};

/**
 * Toggle region color-coding across the whole spine. With `on=false` every part
 * returns to its stored base color. Pure per-mesh color writes — no geometry
 * changes — so it's instant and reversible.
 */
export function setRegionColors(registry, on) {
  for (const part of registry.parts) {
    if (!part.material.color) continue;
    if (on && REGION_COLORS[part.region] !== undefined) {
      part.material.color.setHex(REGION_COLORS[part.region]);
    } else {
      part.material.color.copy(part.baseColor);
    }
  }
}

const HIGHLIGHT_EMISSIVE = new THREE.Color(0x2b6cff);

/**
 * Highlight a single part with an emissive glow (reversible). Pass null to
 * clear. Returns the previously-highlighted entry's mesh for bookkeeping.
 */
export function highlightPart(entry) {
  if (!entry || !entry.material.emissive) return;
  entry.material.emissive.copy(HIGHLIGHT_EMISSIVE);
  entry.material.emissiveIntensity = 0.6;
}

export function clearHighlight(entry) {
  if (!entry || !entry.material.emissive) return;
  if (entry.baseEmissive) entry.material.emissive.copy(entry.baseEmissive);
  else entry.material.emissive.setHex(0x000000);
  entry.material.emissiveIntensity = 1.0;
}

/**
 * Isolate mode: fade everything except the spine + pelvis (and discs).
 * Faded parts become translucent rather than hidden, so they read as ghosted
 * context. Reversible via the stored base opacity.
 */
const FOCUS_REGIONS = new Set([
  REGIONS.CERVICAL,
  REGIONS.THORACIC,
  REGIONS.LUMBAR,
  REGIONS.SACRUM,
  REGIONS.COCCYX,
  REGIONS.DISC,
  REGIONS.PELVIS
]);

export function setIsolate(registry, on) {
  for (const part of registry.parts) {
    const focused = FOCUS_REGIONS.has(part.region);
    if (on && !focused) {
      part.material.transparent = true;
      part.material.opacity = 0.06;
      part.material.depthWrite = false;
    } else {
      part.material.transparent = part.baseTransparent;
      part.material.opacity = part.baseOpacity;
      part.material.depthWrite = true;
    }
  }
}

/**
 * Walk the loaded model, give every mesh its own material instance (so colors
 * can be changed independently), and return a registry.
 *
 * @param {THREE.Object3D} root
 * @param {{ isPlaceholder?: boolean }} opts
 */
export function buildRegistry(root, { isPlaceholder = false } = {}) {
  /** @type {Array<{ mesh: THREE.Mesh, name: string, region: string, code: string|null, baseColor: THREE.Color, material: THREE.Material }>} */
  const parts = [];
  const byRegion = Object.fromEntries(Object.values(REGIONS).map((r) => [r, []]));

  const boneMat = makeBoneMaterial();
  const discMat = makeDiscMaterial();

  root.traverse((o) => {
    if (!o.isMesh) return;

    const { region, code } = classifyByName(o.name);
    const isDisc = region === REGIONS.DISC;

    // Placeholder meshes already carry shared materials; the real GLB may bring
    // textured PBR materials we want to keep. Give discs the contrasting
    // material; for the real model, only override material if it's clearly
    // untextured (so we don't wipe out good scanned textures).
    if (isPlaceholder) {
      o.material = (isDisc ? discMat : boneMat).clone();
    } else {
      const existing = o.material;
      const hasTexture =
        existing && (existing.map || existing.normalMap || existing.aoMap);
      if (isDisc) {
        o.material = discMat.clone();
      } else if (!hasTexture) {
        o.material = boneMat.clone();
      } else {
        // Keep the model's own material but ensure env reflections look right.
        existing.envMapIntensity = 0.6;
      }
    }

    o.castShadow = true;
    o.receiveShadow = true;

    const baseColor = o.material.color ? o.material.color.clone() : new THREE.Color(0xffffff);

    const entry = {
      mesh: o,
      name: o.name || '(unnamed)',
      region,
      code,
      baseColor,
      material: o.material,
      // Remember the material's natural emissive so highlights are reversible.
      baseEmissive: o.material.emissive ? o.material.emissive.clone() : null,
      baseOpacity: o.material.opacity,
      baseTransparent: o.material.transparent
    };
    entry.label = labelFor(entry);
    parts.push(entry);
    o.userData.anatomy = entry;
    byRegion[region].push(entry);
  });

  return {
    parts,
    byRegion,
    /** All spine vertebrae + discs, top-to-bottom-ish. */
    spine: [
      ...byRegion[REGIONS.CERVICAL],
      ...byRegion[REGIONS.THORACIC],
      ...byRegion[REGIONS.LUMBAR],
      ...byRegion[REGIONS.SACRUM],
      ...byRegion[REGIONS.COCCYX],
      ...byRegion[REGIONS.DISC]
    ],
    discs: byRegion[REGIONS.DISC],
    find: (code) => parts.find((p) => p.code === code) || null,
    summary() {
      return Object.fromEntries(
        Object.entries(byRegion).map(([k, v]) => [k, v.length])
      );
    }
  };
}
