import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * Ingress → City Gate (US6, T062, FR-023).
 * A stone archway with a portcullis at the district boundary. One per Ingress.
 */
export function CityGates({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const gates = useMemo(() => buildings.filter((b) => b.resourceType === 'ingress'), [buildings]);
  if (lod === 'far' || gates.length === 0) return null;
  return (
    <>
      {gates.map((b) => (
        <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]} rotation={[0, b.rotationY, 0]}>
          {/* Left tower */}
          <mesh castShadow position={[-2.4, 2.5, 0]}>
            <boxGeometry args={[1.8, 5, 2]} />
            <meshStandardMaterial color="#7a6a55" roughness={0.95} />
          </mesh>
          {/* Right tower */}
          <mesh castShadow position={[2.4, 2.5, 0]}>
            <boxGeometry args={[1.8, 5, 2]} />
            <meshStandardMaterial color="#7a6a55" roughness={0.95} />
          </mesh>
          {/* Arch lintel */}
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[6.6, 1.2, 2]} />
            <meshStandardMaterial color="#6a5a48" roughness={0.9} />
          </mesh>
          {/* Portcullis bars */}
          {[-1.6, -0.8, 0, 0.8, 1.6].map((x, i) => (
            <mesh key={i} position={[x, 2.4, 0]}>
              <boxGeometry args={[0.12, 4, 0.12]} />
              <meshStandardMaterial color="#3a3028" roughness={0.8} metalness={0.5} />
            </mesh>
          ))}
          {/* Crenellations */}
          {[-2.4, 2.4].map((sx, ti) =>
            [0, 0.7, 1.4].map((_ox, ci) => (
              <mesh key={`${ti}-${ci}`} position={[sx + (ci - 1) * 0.5, 5.4, 0]}>
                <boxGeometry args={[0.4, 0.6, 0.4]} />
                <meshStandardMaterial color="#7a6a55" roughness={0.95} />
              </mesh>
            ))
          )}
        </group>
      ))}
    </>
  );
}

export default CityGates;
