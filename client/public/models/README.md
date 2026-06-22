# Kube Kingdom — 3D model drop-in

Drop CC0 glTF/GLB models here to replace the procedural geometry with real
buildings. The app falls back to procedural shapes for anything missing, so you
can add models incrementally.

## Recommended CC0 packs (all free)

- **KayKit Medieval Builder** — https://kaylousberg.itch.io (excellent cohesive
  medieval buildings)
- **Quaternius Medieval Village / Ultimate Medieval** — https://quaternius.com
- **Kenney Castle Kit / City Kit** — https://kenney.nl/assets

## How to install

1. Download a pack and unzip it.
2. Copy a few GLBs into this folder and rename to these canonical names:

   | File              | Used for                          |
   | ----------------- | --------------------------------- |
   | `node.glb`        | Node landmark (castle / big keep) |
   | `house.glb`       | Pod dwelling (small house)        |
   | `tree.glb`        | Decorative trees                  |

   (Or keep the pack's names and edit the paths in
   `client/src/render/modelManifest.ts`.)

3. In `client/src/render/modelManifest.ts`, set `enabled: true`.
4. Reload the app. Tune `scale` / `yOffset` per entry if a model is too big or
   floats — the demo tavern probe, for reference, needed about `scale: 0.4`.

Models are loaded with `useGLTF` and cached; multiple placements share one load.
GLBs over ~500 KB should ideally be DRACO-compressed (see plan.md, task T066).
