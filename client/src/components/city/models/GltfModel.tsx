import { useGLTF, Clone } from '@react-three/drei';
import type { Vec3 } from '../../../types/layout';

/**
 * Renders a glTF/GLB model from /public/models. Multiple placements share one
 * cached load via drei <Clone>. This is the real-asset path (constitution
 * Principle I) — procedural geometry is the fallback when no model is supplied.
 */
export function GltfModel({
  url,
  position,
  scale = 1,
  rotationY = 0,
}: {
  url: string;
  position?: Vec3;
  scale?: number;
  rotationY?: number;
}) {
  const { scene } = useGLTF(url);
  return (
    <Clone
      object={scene}
      position={position ? [position.x, position.y, position.z] : [0, 0, 0]}
      scale={scale}
      rotation={[0, rotationY, 0]}
    />
  );
}

export default GltfModel;
