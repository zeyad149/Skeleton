import { defineConfig } from 'vite';

// Dev server is required: GLB files cannot be loaded over file:// (CORS).
// `npm run dev` serves this folder so the loader can fetch models/skeleton.glb.
export default defineConfig({
  server: {
    host: true,
    open: true
  },
  // Large GLB meshes should not be inlined as base64.
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.bin', '**/*.drc'],
  build: {
    target: 'esnext'
  }
});
