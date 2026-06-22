import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * DaemonSet → Watchtower (US6, T063, FR-023).
 * A tall defensive tower — one per DaemonSet. The round form distinguishes it
 * from the rectangular node castle.
 */
export function Watchtower({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const towers = useMemo(() => buildings.filter((b) => b.resourceType === 'daemonset'), [buildings]);
  if (lod === 'far' || towers.length === 0) return null;
  return (
    <>
      {towers.map((b) => (
        <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]} rotation={[0, b.rotationY, 0]}>
          {/* Shaft */}
          <mesh castShadow position={[0, 4, 0]}>
            <cylinderGeometry args={[1.1, 1.3, 8, 12]} />
            <meshStandardMaterial color="#7a6a55" roughness={0.95} />
          </mesh>
          {/* Top room (wider) */}
          <mesh castShadow position={[0, 8.6, 0]}>
            <cylinderGeometry args={[1.5, 1.1, 1.4, 12]} />
            <meshStandardMaterial color="#6a5a48" roughness={0.9} />
          </mesh>
          {/* Conical cap */}
          <mesh position={[0, 9.9, 0]}>
            <coneGeometry args={[1.6, 2.2, 12]} />
            <meshStandardMaterial color="#4a2a18" roughness={0.8} />
          </mesh>
          {/* Crenellations */}
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 1.36, 9.6, Math.sin(a) * 1.36]}>
                <boxGeometry args={[0.35, 0.55, 0.35]} />
                <meshStandardMaterial color="#7a6a55" roughness={0.95} />
              </mesh>
            );
          })}
          {/* Arrow slit */}
          <mesh position={[0, 5.5, 1.3]}>
            <boxGeometry args={[0.18, 0.7, 0.12]} />
            <meshStandardMaterial color="#2a2018" roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default Watchtower;
