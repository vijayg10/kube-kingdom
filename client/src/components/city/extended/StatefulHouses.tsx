import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * StatefulSet → Row of numbered townhouses (US6, T063, FR-023).
 * A neat terrace row — StatefulSet ordinals imply stable, ordered residences.
 */
export function StatefulHouses({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const sets = useMemo(() => buildings.filter((b) => b.resourceType === 'statefulset'), [buildings]);
  if (lod === 'far' || sets.length === 0) return null;
  return (
    <>
      {sets.map((b) => {
        const replicas = (b.meta?.replicas as number) ?? 2;
        const count = Math.min(replicas, 5);
        const W = 2.2;
        const totalW = count * W;
        return (
          <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]} rotation={[0, b.rotationY, 0]}>
            {Array.from({ length: count }).map((_, i) => {
              const x = -totalW / 2 + i * W + W / 2;
              return (
                <group key={i} position={[x, 0, 0]}>
                  {/* Terrace house unit */}
                  <mesh castShadow position={[0, 1.2, 0]}>
                    <boxGeometry args={[W * 0.88, 2.4, 2]} />
                    <meshStandardMaterial color="#c8b899" roughness={0.9} />
                  </mesh>
                  <mesh castShadow position={[0, 2.8, 0]}>
                    <boxGeometry args={[W * 0.88, 0.8, 2.2]} />
                    <meshStandardMaterial color="#5a3a28" roughness={0.8} />
                  </mesh>
                  {/* Ordinal marker chimney */}
                  <mesh position={[0, 3.6, 0.3]}>
                    <cylinderGeometry args={[0.12, 0.15, 0.8, 6]} />
                    <meshStandardMaterial color="#4a3a2a" roughness={0.9} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

export default StatefulHouses;
