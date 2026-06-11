# Anatomy Skeleton Studio

A broadcast-quality 3D anatomical skeleton viewer built with **Three.js**, made
for screen-recording educational videos about lower-back and disc pain.

This is being built in **stages**. You are currently looking at **Stage 1**.

---

## Stage 1 — Scene, lighting, color pipeline, loader (this stage)

What's included now:

- **Color-managed rendering** — sRGB output + ACES Filmic tone mapping, so
  recordings look correct and professional on export.
- **Studio lighting** — soft key light (with shadows), cool fill, and a rim/back
  light for clean depth separation, plus a gentle ambient hemisphere.
- **Image-based lighting** (RoomEnvironment) for realistic PBR materials.
- **Anti-aliasing on**, pixel ratio capped at 2 for crisp recording.
- **Soft shadows** (PCFSoft) onto a subtle invisible shadow-catcher.
- **Toggleable backgrounds** — neutral dark gradient, pure white, and solid
  chroma-key green.
- **Smooth orbit / zoom / pan** (mouse + touch) — refined further in Stage 3.
- **Loading progress bar** while the model loads.
- **Draco + Meshopt ready** GLTF loader.
- **Hide UI for recording** with the `H` key.

> While `models/skeleton.glb` is absent, the app shows a clearly-marked
> **procedural placeholder** skeleton so you can confirm the lighting and look.
> It disappears automatically the moment you add the real GLB.

Still to come: Stage 2 (spine detail + per-bone separation), Stage 3
(click-to-label, isolate mode, camera presets), Stage 4 (movement animations +
disc-compression color effect).

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

## Which model to download, and where to put it

Place your model at **`models/skeleton.glb`**. The loader reads exactly that
path.

### Recommended: Z-Anatomy (free, separated bones)

**Source:** <https://github.com/Z-Anatomy/Models-of-human-anatomy>
**License:** Creative Commons **CC-BY-SA 4.0** — commercial use is allowed; you
must (1) attribute Z-Anatomy and (2) share any modified *model* under the same
license. Using it in a video is fine with attribution. (The license is also
noted in `src/loader.js`.)

Z-Anatomy ships as a Blender `.blend` file, so you export the skeleton to GLB
once:

1. Download and open `Z-Anatomy.zip` from the repo in **Blender** (free).
2. In the outliner, isolate the **skeletal system** collection (hide muscles,
   vessels, nerves, etc.). Keep the bones as **separate objects** — do not join
   them; later stages rely on per-bone meshes (each vertebra, disc, pelvis).
3. Select the skeleton, then **File → Export → glTF 2.0 (.glb)** with:
   - Format: **glTF Binary (.glb)**
   - Include: **Selected Objects**
   - Transform: **+Y Up**
   - Geometry: **Apply Modifiers**; enable **Compression (Draco)** if the file
     is large.
4. Save the result as `models/skeleton.glb` in this project.

> Keep the original object names in Blender meaningful (e.g. `L4`, `L5`,
> `Disc_L4_L5`, `Sacrum`, `Pelvis_R`). Stage 2/3 use these names to find and
> color individual vertebrae and discs.

### Alternative: a CC-BY skeleton GLB from Sketchfab

If you prefer a ready-made GLB, download a **CC-BY** (or CC0) full-skeleton from
Sketchfab, confirm the license is commercial-use safe on the model's page, and
save it as `models/skeleton.glb`. Bones may be a single merged mesh — in that
case the per-bone features in later stages will be limited unless the model has
named sub-meshes.

---

## Offline Draco (optional)

The Draco decoder defaults to the Google CDN
(`https://www.gstatic.com/draco/...`, set in `src/loader.js`). If your network
blocks CDNs, copy the decoder from
`node_modules/three/examples/jsm/libs/draco/` into `public/draco/` and change
`DRACO_DECODER_PATH` in `src/loader.js` to `'/draco/'`.

---

## Controls

| Action | Control |
| --- | --- |
| Orbit | Left-drag / one-finger drag |
| Pan | Right-drag / two-finger drag |
| Zoom | Scroll / pinch |
| Switch background | Buttons (bottom-left) |
| Hide/show UI | `H` |
