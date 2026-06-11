# Anatomy Skeleton Studio

A broadcast-quality 3D anatomical skeleton viewer built with **Three.js**, made
for screen-recording educational videos about lower-back and disc pain.

**The real anatomical model is bundled** — no downloads or Blender needed.
`public/models/skeleton.glb` is a real Z-Anatomy export with every vertebra,
every intervertebral disc, and both hip bones as individually named, separable
meshes.

---

## Quick start

Requires **Node.js 18+**.

```bash
npm install
npm run dev
```

Vite will start a local dev server (a dev server is required — GLB files cannot
be loaded directly from `file://`) and open the app in your browser. Press `H`
to hide the UI for clean recording.

To make an optimized production build:

```bash
npm run build
npm run preview
```

---

## The model: source & license (read before publishing)

**Source:** [Z-Anatomy — Models of human anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy)
**License:** [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) —
commercial use **is allowed**, with two conditions:

1. **Attribute Z-Anatomy.** Add a line like
   *“3D anatomy model: Z-Anatomy (CC-BY-SA 4.0)”* to your video description or
   on-screen credits.
2. **ShareAlike applies to the model itself.** If you ever redistribute the 3D
   model (or a modified version of it), it must stay under CC-BY-SA 4.0. This
   does **not** restrict your videos.

The bundled GLB was derived from Z-Anatomy's `Startup.blend`: the “Skeletal
system” bones (with label/overlay helper objects removed) plus all 23
“Intervertebral disc” meshes. Included individually named:
`Atlas (C1)`, `Axis (C2)`, `Vertebra C3…C7`, `Vertebra T1…T12`,
`Vertebra L1…L5`, `Sacrum`, `Coccyx`, `Intervertebral disc C2-C3 … L5-S1`,
`Hip bone.l/.r`, and the rest of the skeleton (~300 bones).

To swap in a different model, replace `public/models/skeleton.glb`. If the new
file is missing, the app falls back to a clearly-marked procedural placeholder.

---

## Features

- **Color-managed rendering** — sRGB output + ACES Filmic tone mapping, so
  recordings look correct and professional on export.
- **Studio lighting** — soft key light (with shadows), cool fill, and a rim/back
  light for clean depth separation, plus image-based lighting for PBR materials.
- **Anti-aliasing on**, pixel ratio capped at 2 for crisp recording; soft
  PCF shadows onto an invisible shadow-catcher.
- **Toggleable backgrounds** — neutral dark gradient, pure white, and solid
  chroma-key green.
- **Per-bone anatomy registry** — every vertebra/disc/bone is independently
  addressable; “Color-code regions” tints each spine region distinctly.
- **Click/tap any bone** to highlight it and show a bilingual (English +
  Arabic) label that tracks the part on screen.
- **Isolate mode** — fades everything except spine + pelvis.
- **Preset cameras** — Front / Side / Back / Lumbar close-up, smoothly animated.
- **Movement animations** — forward-kinematics spine rig: spinal flexion,
  extension, lateral flexion, hip hinge, anterior/posterior pelvic tilt, with
  Play/Pause, Reset, and a Speed slider (0.1×–2×).
- **Disc-compression colouring** — discs redden in proportion to how much the
  spine joint at that disc flexes: spinal flexion lights the lumbar discs red,
  while a hip hinge barely colours them — the core teaching contrast for
  lower-back load.
- **Loading progress bar**; **hide the whole UI** with `H` for recording.

---

## Controls

| Action | Control |
| --- | --- |
| Orbit | Left-drag / one-finger drag |
| Pan freely (no fixed centre) | Right-drag / two-finger drag |
| Zoom toward cursor | Scroll / pinch |
| Re-frame if you drift | **Reset view** button |
| Label a bone | Click / tap it (click again or tap empty space to clear) |
| Camera presets | Front / Side / Back / Lumbar buttons |
| Display mode | **Full body** / **Isolate** (ghost the rest) / **Hide ribcage** (expose the spine) |
| Highlight a spine region | **Cervical / Thoracic / Lumbar / Sacrum / Coccyx** buttons |
| Highlight one vertebra/disc | **Single part…** dropdown (shows its label) · **Clear** to reset |
| Color-code spine regions | **Color-code regions** button |
| Play a movement | Pick a movement, then **▶ Play** (Reset returns to neutral) |
| Slow a movement down | **Speed** slider (0.1×–2×) |
| Switch background | Dark / White / Green buttons |
| Hide/show UI | `H` |

During **flexion / extension** the intervertebral discs both **redden** and
physically **squash and bulge** under load — most at the lumbar levels, which
flex most — to show disc compression. Use **Hide ribcage** + the highlight
buttons to record a clean, exposed spine in context.

---

## Offline Draco (optional)

The GLTF loader is Draco-ready; the decoder defaults to the Google CDN
(`https://www.gstatic.com/draco/...`, set in `src/loader.js`). The bundled GLB
is uncompressed (10.6 MB — instant from localhost), so the decoder is only
fetched if you swap in a Draco-compressed model. If your network blocks CDNs,
copy the decoder from `node_modules/three/examples/jsm/libs/draco/` into
`public/draco/` and change `DRACO_DECODER_PATH` in `src/loader.js` to `'/draco/'`.
