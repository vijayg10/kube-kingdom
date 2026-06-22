import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * LoadBalancer → Crossroads Interchange (US6, T062, FR-023).
 * A cobblestone roundabout with a pillar at center, representing external traffic entry.
 */
export function Interchange({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const lbs = useMemo(() => buildings.filter((b) => b.resourceType === 'loadbalancer'), [buildings]);
  if (lod === 'far' || lbs.length === 0) return null;
  return (
    <>
      {lbs.map((b) => (
        <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]}>
          {/* Cobblestone roundabout disc */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[4, 16]} />
            <meshStandardMaterial color="#8a7a64" roughness={0.95} />
          </mesh>
          {/* Central obelisk */}
          <mesh castShadow position={[0, 2.8, 0]}>
            <cylinderGeometry args={[0.2, 0.4, 5.6, 8]} />
            <meshStandardMaterial color="#6a5a48" roughness={0.85} />
          </mesh>
          {/* Obelisk top */}
          <mesh position={[0, 5.8, 0]}>
            <coneGeometry args={[0.4, 0.9, 4]} />
            <meshStandardMaterial color="#c8a050" roughness={0.6} metalness={0.4} />
          </mesh>
          {/* Road approach marks */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
            <mesh key={i} position={[Math.cos(a) * 3.4, 0.06, Math.sin(a) * 3.4]} rotation={[-Math.PI / 2, 0, a]}>
              <planeGeometry args={[1.4, 2.4]} />
              <meshStandardMaterial color="#6a5a48" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

export default Interchange;
