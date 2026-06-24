/**
 * Maps city roles → glTF/GLB model files under `client/public/models/`.
 *
 * HOW TO ADD REAL MODELS (the "drop a pack" flow):
 *   1. Download a CC0 medieval pack (KayKit Medieval Builder, Quaternius
 *      Medieval Village, or Kenney Castle/City kits).
 *   2. Copy a few GLBs into `client/public/models/` and rename to the canonical
 *      names below (or edit the paths here to match the pack's filenames).
 *   3. Flip `enabled` to true. Components load the model and fall back to
 *      procedural geometry automatically if a file is missing or fails to load.
 *
 * Keep `enabled: false` to run fully procedural (no asset downloads needed).
 */

export interface ModelEntry {
  /** Public URL (served from client/public). */
  url: string;
  /** Uniform scale applied to the loaded model. Tune per pack. */
  scale: number;
  /** Y offset so the model sits on the ground. */
  yOffset?: number;
  /** Extra Y rotation (radians) to face the model correctly. */
  rotationY?: number;
}

export interface ModelManifest {
  enabled: boolean;
  /** Node landmark building (castle / keep / large building). */
  node?: ModelEntry;
  /** Pod dwelling (small house/cottage). Should ideally be a single mesh so it
   *  can be instanced for performance. */
  house?: ModelEntry;
  /** Decorative tree. Instanced. */
  tree?: ModelEntry;
  /** Secret → fortified vault. */
  vault?: ModelEntry;
}

// Quaternius "Medieval Village Pack" (CC0), converted OBJ→GLB into
// /models/medieval/. Trees aren't in this pack, so they stay procedural.
export const modelManifest: ModelManifest = {
  enabled: true,
  node: { url: '/models/medieval/Bell_Tower.glb', scale: 3, yOffset: 0, rotationY: 0 },
  house: { url: '/models/medieval/House_1.glb', scale: 1.4, yOffset: 0, rotationY: 0 },
  tree: { url: '/models/nature/CommonTree_1.gltf', scale: 1.0, yOffset: 0, rotationY: 0 },
  vault: { url: '/models/medieval/Vault.glb', scale: 0.24, yOffset: 0, rotationY: 0 },
};
