import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * Lamp posts around district walls. Two instanced meshes: the dark post and a
 * warm emissive lantern on top that glows against the golden-hour light, adding
 * the cozy diorama detail. Hidden at far LOD (small detail).
 */
const _d = new THREE.Object3D();

export function Lamps({ positions }: { positions: Vec3[] }) {
  const lod = useLOD();
  const postRef = useRef<THREE.InstancedMesh>(null);
  const lampRef = useRef<THREE.InstancedMesh>(null);

  const postGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6);
    g.translate(0, 1.2, 0);
    return g;
  }, []);
  const lampGeom = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.22, 0);
    g.translate(0, 2.5, 0);
    return g;
  }, []);
  const lampMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffd98a',
        emissive: new THREE.Color('#ffb84d'),
        emissiveIntensity: 2.2,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    const post = postRef.current;
    const lamp = lampRef.current;
    if (!post || !lamp) return;
    positions.forEach((p, i) => {
      _d.position.set(p.x, 0, p.z);
      _d.rotation.set(0, 0, 0);
      _d.scale.setScalar(1);
      _d.updateMatrix();
      post.setMatrixAt(i, _d.matrix);
      lamp.setMatrixAt(i, _d.matrix);
    });
    post.count = positions.length;
    lamp.count = positions.length;
    post.instanceMatrix.needsUpdate = true;
    lamp.instanceMatrix.needsUpdate = true;
  }, [positions]);

  if (positions.length === 0 || lod === 'far') return null;
  return (
    <group>
      <instancedMesh ref={postRef} args={[postGeom, undefined, positions.length]} castShadow>
        <meshStandardMaterial color="#2f2a22" roughness={0.7} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={lampRef} args={[lampGeom, lampMat, positions.length]} />
    </group>
  );
}

export default Lamps;
