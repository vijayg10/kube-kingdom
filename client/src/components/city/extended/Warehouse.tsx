import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * PersistentVolume / PVC → Warehouse / Storage barn (US6, T064, FR-023).
 * A large low barn structure — heavier than houses, representing durable storage.
 */
export function Warehouse({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const pvs = useMemo(() => buildings.filter((b) => b.resourceType === 'pv'), [buildings]);
  if (lod === 'far' || pvs.length === 0) return null;
  return (
    <>
      {pvs.map((b) => {
        const phase = b.meta?.phase as string ?? 'Available';
        const color = phase === 'Bound' ? '#8a6a3a' : phase === 'Released' ? '#7a7a7a' : '#6a8a3a';
        return (
          <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]} rotation={[0, b.rotationY, 0]}>
            {/* Barn body */}
            <mesh castShadow position={[0, 1.4, 0]}>
              <boxGeometry args={[4.5, 2.8, 3]} />
              <meshStandardMaterial color={color} roughness={0.92} />
            </mesh>
            {/* Gambrel-style roof */}
            <mesh castShadow position={[0, 3.2, 0]}>
              <boxGeometry args={[4.6, 0.6, 3.1]} />
              <meshStandardMaterial color="#5a3a24" roughness={0.85} />
            </mesh>
            <mesh position={[0, 3.9, 0]} rotation={[0, 0, 0]}>
              <cylinderGeometry args={[0.1, 2.4, 1.4, 4]} />
              <meshStandardMaterial color="#4a2a18" roughness={0.85} />
            </mesh>
            {/* Large barn door */}
            <mesh position={[0, 1.0, 1.52]}>
              <boxGeometry args={[1.8, 2, 0.08]} />
              <meshStandardMaterial color="#3a2a18" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export default Warehouse;
