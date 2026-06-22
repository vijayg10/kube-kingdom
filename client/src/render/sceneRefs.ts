import type * as THREE from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';

/**
 * Bridge for DOM-side HUD code (box-select) to reach the live camera and
 * controls that live inside the R3F Canvas. Set by in-canvas capture
 * components; read by overlays rendered as Canvas siblings.
 */
export const sceneRefs: {
  camera: THREE.Camera | null;
  controls: MapControlsImpl | null;
} = {
  camera: null,
  controls: null,
};
