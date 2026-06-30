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
 * Animated road traffic (US4, FR-017): horse carts ride the service→pod road
 * branches. Cart speed reflects the service's latency tier; a colored beacon
 * above each cart shows the tier (green→red); failed services stop their carts.
 */
const _pos = new THREE.Vector3();
const _tan = new THREE.Vector3();

interface CartState {
  lane: RoadLane;
  t: number;
  offset: number;
}

const CART_SCALE = 0.5;

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

  const { scene: cartScene, animations } = useGLTF('/models/medieval/Horse_Cart.glb');

  const carts = useMemo<CartState[]>(() => {
    const lanes = buildRoadLanes(roads, buildings);
    return lanes.map((lane, i) => ({ lane, t: (i * 0.37) % 1, offset: (i % 3) * 0.12 }));
  }, [roads, buildings]);

  // One cloned scene + mixer per cart for independent animation.
  // Pre-build both action sets; switch between them in useFrame.
  const cartData = useMemo(() => {
    const getClip = (name: string) => THREE.AnimationClip.findByName(animations, name) ?? null;
    return carts.map(() => {
      const scene = SkeletonUtils.clone(cartScene) as THREE.Group;
      const mixer = new THREE.AnimationMixer(scene);

      const moveActions = ['Walk', 'Wheel_LAction', 'Wheel_RAction']
        .map(getClip).filter(Boolean).map((c) => mixer.clipAction(c!));
      const idleAction = getClip('Idle') ? mixer.clipAction(getClip('Idle')!) : null;

      // Start in moving state by default.
      moveActions.forEach((a) => a.play());

      return { scene, mixer, moveActions, idleAction, isMoving: true };
    });
  }, [carts, cartScene, animations]);

  useEffect(() => {
    return () => cartData.forEach(({ mixer }) => mixer.stopAllAction());
  }, [cartData]);

  useFrame((_s, dt) => {
    const traffic = useClusterStore.getState().traffic;
    for (let i = 0; i < carts.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;

      const cart  = carts[i];
      // Carts only exist where there's real traffic data. No event for this
      // service (e.g. a real cluster with no traffic source) → hide the cart
      // rather than imply healthy "normal" flow on every road.
      const event = traffic.get(cart.lane.serviceUid);
      g.visible = !!event;
      if (!event) continue;

      const state = latencyState(event);
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

      const data = cartData[i];
      if (data) {
        const moving = speed > 0;
        if (moving !== data.isMoving) {
          data.isMoving = moving;
          if (moving) {
            data.idleAction?.stop();
            data.moveActions.forEach((a) => a.play());
          } else {
            data.moveActions.forEach((a) => a.stop());
            data.idleAction?.play();
          }
        }
        data.mixer.update(dt);
      }
    }
  });

  if (lod === 'far' || carts.length === 0) return null;

  return (
    <>
      {carts.map((_, i) => (
        <group key={i} ref={(el) => (groupRefs.current[i] = el)} visible={false}>
          <primitive object={cartData[i].scene} scale={CART_SCALE} castShadow />
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
