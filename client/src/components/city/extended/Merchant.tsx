import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * Job / CronJob → Traveling merchant (US6, T063, FR-023).
 * A moving merchant cart + stall. Completed jobs appear faded; active ones animate.
 */

function MerchantCart({ b }: { b: BuildingLayout }) {
  const ref = useRef<THREE.Group>(null);
  const state = b.meta?.state as string ?? 'Active';
  const isActive = state === 'Active';
  const startAngle = useMemo(() => (Math.random() * Math.PI * 2), []);
  const orbitR = 5 + (Math.random() * 2);

  useFrame((s) => {
    if (!ref.current || !isActive) return;
    const t = s.clock.elapsedTime * 0.4 + startAngle;
    ref.current.position.set(
      b.position.x + Math.cos(t) * orbitR,
      0,
      b.position.z + Math.sin(t) * orbitR,
    );
    ref.current.rotation.y = -t + Math.PI / 2;
  });

  return (
    <group ref={ref} position={[b.position.x, 0, b.position.z]}>
      {/* Cart body */}
      <mesh castShadow position={[0, 0.7, 0]}>
        <boxGeometry args={[1.6, 0.7, 0.9]} />
        <meshStandardMaterial color={isActive ? '#b0803a' : '#6a5028'} roughness={0.85} opacity={isActive ? 1 : 0.6} transparent />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[1.7, 0.1, 1]} />
        <meshStandardMaterial color={isActive ? '#c03a28' : '#803028'} roughness={0.8} />
      </mesh>
      {/* Wheels */}
      {[-0.7, 0.7].map((x, i) => (
        <mesh key={i} position={[x, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.07, 6, 12]} />
          <meshStandardMaterial color="#3a2a18" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function Merchant({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const merchants = useMemo(() => buildings.filter((b) => b.resourceType === 'job'), [buildings]);
  if (lod === 'far' || merchants.length === 0) return null;
  return (
    <>
      {merchants.map((b) => <MerchantCart key={b.resourceId} b={b} />)}
    </>
  );
}

export default Merchant;
