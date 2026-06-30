import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import type { BuildingLayout, DistrictLayout, Vec3 } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';
import { mulberry32, hashString } from '../../../layout/seededRandom';

useGLTF.preload('/models/medieval/Horse_Cart.glb');

const CART_SCALE = 0.5;
const SPEED = 1; // world units per second along the perimeter

// Walk the outer shore boundary at this fraction of the outer island scale.
// 0.9 keeps the cart just inside the visible grass edge.
const PERIMETER_SCALE = 1.3 * 0.9;

const _pt  = new THREE.Vector3();
const _tan = new THREE.Vector3();

function buildPerimeterCurve(district: DistrictLayout): THREE.CatmullRomCurve3 {
  const { center, wallVertices } = district;
  const pts: THREE.Vector3[] = wallVertices.map((v: Vec3) =>
    new THREE.Vector3(
      center.x + (v.x - center.x) * PERIMETER_SCALE,
      0,
      center.z + (v.z - center.z) * PERIMETER_SCALE,
    ),
  );
  return new THREE.CatmullRomCurve3(pts, /* closed */ true);
}

function MerchantCart({ b, district }: { b: BuildingLayout; district: DistrictLayout | undefined }) {
  const { scene: cartScene, animations } = useGLTF('/models/medieval/Horse_Cart.glb');

  const { clonedScene, mixer, moveActions } = useMemo(() => {
    const clonedScene = SkeletonUtils.clone(cartScene) as THREE.Group;
    const mixer = new THREE.AnimationMixer(clonedScene);
    const find = (name: string) => THREE.AnimationClip.findByName(animations, name) ?? null;
    const moveActions = ['Walk', 'Wheel_LAction', 'Wheel_RAction']
      .map(find).filter(Boolean).map((c) => mixer.clipAction(c!));
    moveActions.forEach((a) => a.play());
    return { clonedScene, mixer, moveActions };
  }, [cartScene, animations]);

  useEffect(() => () => { moveActions.forEach((a) => a.stop()); }, [moveActions]);

  const curve = useMemo(
    () => (district ? buildPerimeterCurve(district) : null),
    [district],
  );

  // Seed a random start offset so carts don't all begin at the same spot.
  const rng    = mulberry32(hashString(`merchant:${b.resourceId}`));
  const pathT  = useRef(rng());
  const ref    = useRef<THREE.Group>(null);

  useFrame((_s, dt) => {
    if (!ref.current || !curve) return;

    pathT.current = (pathT.current + (SPEED * dt) / curve.getLength()) % 1;

    curve.getPointAt(pathT.current, _pt);
    ref.current.position.copy(_pt);

    curve.getTangentAt(pathT.current, _tan);
    ref.current.rotation.y = Math.atan2(_tan.x, _tan.z);

    mixer.update(dt);
  });

  return (
    <group ref={ref} position={[b.position.x, 0, b.position.z]}>
      <primitive object={clonedScene} scale={CART_SCALE} castShadow />
    </group>
  );
}

export function Merchant({
  buildings,
  districts,
}: {
  buildings: BuildingLayout[];
  districts: DistrictLayout[];
}) {
  const lod = useLOD();
  const merchants = useMemo(() => buildings.filter((b) => b.resourceType === 'job'), [buildings]);
  if (lod === 'far' || merchants.length === 0) return null;
  return (
    <>
      {merchants.map((b) => (
        <MerchantCart
          key={b.resourceId}
          b={b}
          district={districts.find((d) => d.namespace === b.namespace)}
        />
      ))}
    </>
  );
}

export default Merchant;
