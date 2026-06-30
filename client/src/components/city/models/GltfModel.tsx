import { useMemo } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';

const _box = new THREE.Box3();

/**
 * Renders a glTF/GLB model from /public/models. Multiple placements share one
 * cached load via drei <Clone>. This is the real-asset path (constitution
 * Principle I) — procedural geometry is the fallback when no model is supplied.
 *
 * groundAlign: automatically lifts the model so its lowest point sits at y=0,
 * compensating for models whose internal origin isn't at their base.
 */
export function GltfModel({
  url,
  position,
  scale = 1,
  rotationY = 0,
  groundAlign = false,
}: {
  url: string;
  position?: Vec3;
  scale?: number;
  rotationY?: number;
  groundAlign?: boolean;
}) {
  const { scene } = useGLTF(url);

  const yOffset = useMemo(() => {
    if (!groundAlign) return position?.y ?? 0;
    _box.setFromObject(scene);
    // min.y is in model-local space; multiply by scale to get world offset
    return (position?.y ?? 0) - _box.min.y * scale;
  }, [scene, groundAlign, scale, position?.y]);

  return (
    <Clone
      object={scene}
      position={[position?.x ?? 0, yOffset, position?.z ?? 0]}
      scale={scale}
      rotation={[0, rotationY, 0]}
    />
  );
}

export default GltfModel;
