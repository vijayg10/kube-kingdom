import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import type { DistrictLayout } from '../../types/layout';
import { useLOD } from '../../hooks/useLOD';

/**
 * A namespace rendered as a tinted district on its island. The colored ground
 * patch is the primary far-LOD signal (constitution Principle III). Walls are
 * replaced by the island shoreline — the island shape itself is the boundary.
 */

function groundShape(verts: DistrictLayout['wallVertices'], center: DistrictLayout['center']) {
  const shape = new THREE.Shape();
  verts.forEach((v, i) => {
    const x = v.x - center.x;
    const z = v.z - center.z;
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  geom.rotateX(-Math.PI / 2);
  return geom;
}

export function DistrictPatch({ district }: { district: DistrictLayout }) {
  const lod = useLOD();
  const { center, wallVertices, color, namespace, radius } = district;

  const ground = useMemo(() => groundShape(wallVertices, center), [wallVertices, center]);

  return (
    <group position={[center.x, 0, center.z]}>
      {/* Tinted ground patch (z-offset above grass to avoid z-fighting). */}
      <mesh geometry={ground} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={color} roughness={1} transparent opacity={0.55} />
      </mesh>

      {lod !== 'close' && (
        <Text
          position={[0, 5, 0]}
          fontSize={Math.max(3, radius * 0.18)}
          color="#2b2014"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.15}
          outlineColor="#e8d9b5"
        >
          {namespace}
        </Text>
      )}
    </group>
  );
}

export function Districts({ districts }: { districts: DistrictLayout[] }) {
  return (
    <>
      {districts.map((d) => (
        <DistrictPatch key={d.namespace} district={d} />
      ))}
    </>
  );
}

export default Districts;
