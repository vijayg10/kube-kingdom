import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
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

const HORSE_SCALE    = 0.21;
const WAGON_SCALE    = 0.56;
const HORSE_OFFSET_Z = 0.5;

export function Traffic({
  roads,
  buildings,
}: {
  roads: RoadLayout[];
  buildings: BuildingLayout[];
}) {
  const lod = useLOD();
  const groupRefs  = useRef<(THREE.Group | null)[]>([]);
  const beaconRefs = useRef<(THREE.Mesh | null)[]>([]);

  const { scene: wagonScene } = useGLTF('/models/medieval/Prop_Wagon.gltf');
  const { scene: horseScene, animations } = useGLTF('/models/medieval/Bull.gltf');

  const carts = useMemo<CartState[]>(() => {
    const lanes = buildRoadLanes(roads, buildings);
    return lanes.map((lane, i) => ({ lane, t: (i * 0.37) % 1, offset: (i % 3) * 0.12 }));
  }, [roads, buildings]);

  // One stable clone per cart — never re-created on render.
  const wagonClones = useMemo(
    () => carts.map(() => wagonScene.clone(true)),
    [carts, wagonScene],
  );

  // Bull clones + their own AnimationMixers so each instance animates independently.
  const horseData = useMemo(() => {
    const walkClip = THREE.AnimationClip.findByName(animations, 'Walk');
    return carts.map(() => {
      const scene = SkeletonUtils.clone(horseScene) as THREE.Group;
      const mixer = new THREE.AnimationMixer(scene);
      if (walkClip) mixer.clipAction(walkClip).play();
      return { scene, mixer };
    });
  }, [carts, horseScene, animations]);

  // Stop all mixers on unmount.
  useEffect(() => {
    return () => horseData.forEach(({ mixer }) => mixer.stopAllAction());
  }, [horseData]);

  useFrame((_s, dt) => {
    const traffic = useClusterStore.getState().traffic;
    for (let i = 0; i < carts.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;

      const cart  = carts[i];
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

      horseData[i]?.mixer.update(dt);
    }
  });

  if (lod === 'far' || carts.length === 0) return null;

  return (
    <>
      {carts.map((_, i) => (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)}>
          {/* Wagon */}
          <primitive object={wagonClones[i]} scale={WAGON_SCALE} castShadow />
          {/* Horse in front of wagon, facing travel direction */}
          <primitive
            object={horseData[i].scene}
            scale={HORSE_SCALE}
            position={[0, 0, HORSE_OFFSET_Z]}
            rotation={[0, 0, 0]}
            castShadow
          />
          {/* Latency beacon */}
          <mesh ref={(el) => (beaconRefs.current[i] = el)} position={[0, 1.8, 0]}>
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export default Traffic;
