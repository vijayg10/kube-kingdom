import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';
import { hashString, mulberry32 } from '../../../layout/seededRandom';

/**
 * Low-poly trees as two separate InstancedMeshes (trunk + foliage).
 * Uses CylinderGeometry + ConeGeometry individually — no mergeGeometries
 * (which produced a raw BufferGeometry that was suspected to cause N8AO issues;
 * the actual N8AO fix is the deferred PostFX Suspense pattern in CityScene.tsx).
 */

const _d = new THREE.Object3D();

const trunkGeom = new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6);
trunkGeom.translate(0, 0.55, 0);

const foliageGeom = new THREE.ConeGeometry(0.95, 1.6, 7);
foliageGeom.translate(0, 1.7, 0);

const foliageTipGeom = new THREE.ConeGeometry(0.7, 1.2, 7);
foliageTipGeom.translate(0, 2.6, 0);

export function Trees({ positions }: { positions: Vec3[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);
  const tipRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const trunk = trunkRef.current;
    const foliage = foliageRef.current;
    const tip = tipRef.current;
    if (!trunk || !foliage || !tip) return;

    positions.forEach((p, i) => {
      const rng = mulberry32(hashString(`tree:${p.x.toFixed(1)},${p.z.toFixed(1)}`));
      const scale = 0.8 + rng() * 0.9;
      const ry = rng() * Math.PI * 2;
      _d.position.set(p.x, 0, p.z);
      _d.rotation.set(0, ry, 0);
      _d.scale.set(scale, scale * (0.9 + rng() * 0.4), scale);
      _d.updateMatrix();
      trunk.setMatrixAt(i, _d.matrix);
      foliage.setMatrixAt(i, _d.matrix);
      tip.setMatrixAt(i, _d.matrix);
    });

    trunk.count = positions.length;
    foliage.count = positions.length;
    tip.count = positions.length;
    trunk.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    tip.instanceMatrix.needsUpdate = true;
    trunk.computeBoundingSphere();
    foliage.computeBoundingSphere();
    tip.computeBoundingSphere();
  }, [positions]);

  if (positions.length === 0) return null;

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeom, undefined, positions.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color="#6b4a2b" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={foliageRef} args={[foliageGeom, undefined, positions.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color="#3f7d3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={tipRef} args={[foliageTipGeom, undefined, positions.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color="#4f9145" roughness={0.9} />
      </instancedMesh>
    </>
  );
}

export default Trees;
