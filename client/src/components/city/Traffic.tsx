import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingLayout, RoadLayout } from '../../types/layout';
import { buildRoadLanes, type RoadLane } from '../../layout/roadCurves';
import { useClusterStore } from '../../store/clusterStore';
import { useLOD } from '../../hooks/useLOD';
import { latencyState, STATE_COLOR, STATE_SPEED } from './traffic/trafficState';

/**
 * Animated road traffic (US4, FR-017): carts ride the service→pod road branches.
 * Cart speed reflects the service's latency tier; a colored beacon above each
 * cart shows the tier (green→red); failed services stop their carts and flag red.
 * All animation is in useFrame reading traffic straight from the store.
 */
const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

interface CartState {
  lane: RoadLane;
  t: number;
  offset: number;
}

export function Traffic({
  roads,
  buildings,
}: {
  roads: RoadLayout[];
  buildings: BuildingLayout[];
}) {
  const lod = useLOD();
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const beaconRefs = useRef<(THREE.Mesh | null)[]>([]);

  const carts = useMemo<CartState[]>(() => {
    const lanes = buildRoadLanes(roads, buildings);
    return lanes.map((lane, i) => ({ lane, t: (i * 0.37) % 1, offset: (i % 3) * 0.12 }));
  }, [roads, buildings]);

  useFrame((_s, dt) => {
    const traffic = useClusterStore.getState().traffic;
    for (let i = 0; i < carts.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const cart = carts[i];
      const state = latencyState(traffic.get(cart.lane.serviceUid));
      const speed = STATE_SPEED[state];
      cart.t = (cart.t + speed * dt) % 1;

      const curve = cart.lane.curve;
      curve.getPointAt(cart.t, _pos);
      g.position.set(_pos.x, _pos.y + 0.2, _pos.z);
      curve.getTangentAt(cart.t, _tan);
      g.rotation.y = Math.atan2(_tan.x, _tan.z);

      const beacon = beaconRefs.current[i];
      if (beacon) {
        const mat = beacon.material as THREE.MeshStandardMaterial;
        mat.color.copy(STATE_COLOR[state]);
        mat.emissive.copy(STATE_COLOR[state]);
        beacon.visible = state !== 'normal';
      }
    }
  });

  if (lod === 'far' || carts.length === 0) return null;

  return (
    <>
      {carts.map((_, i) => (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          {/* Simple cart body (the GLB Cart is reserved for close hero shots). */}
          <mesh castShadow position={[0, 0.25, 0]}>
            <boxGeometry args={[0.6, 0.5, 1.0]} />
            <meshStandardMaterial color="#7a5a36" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.7, 0.15, 1.1]} />
            <meshStandardMaterial color="#4a3a2a" roughness={1} />
          </mesh>
          {/* Latency beacon. */}
          <mesh ref={(el) => (beaconRefs.current[i] = el)} position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default Traffic;
