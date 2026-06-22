import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';

/**
 * Flickering flames on CrashLoopBackOff pods (PROMPT health table, FR-011).
 * Two instanced flame cones per site; scale + emissive flicker animated in
 * useFrame so no React work happens per frame.
 */
const FLAMES_PER_SITE = 2;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function FireEffect({ sites }: { sites: Vec3[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = sites.length * FLAMES_PER_SITE;
  const geom = useMemo(() => new THREE.ConeGeometry(0.32, 0.95, 6), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff7a1a',
        emissive: new THREE.Color('#ff5a00'),
        emissiveIntensity: 2.4,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    [],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh || count === 0) return;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (const site of sites) {
      for (let f = 0; f < FLAMES_PER_SITE; f++) {
        const phase = i * 1.7;
        const flick = 0.75 + Math.sin(t * 12 + phase) * 0.25 + Math.random() * 0.08;
        _p.set(site.x + (f === 0 ? -0.4 : 0.4), 3.2 + flick * 0.4, site.z);
        _q.identity();
        _s.set(flick * 0.9, flick * 1.25, flick * 0.9);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
        i++;
      }
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geom, mat, count]} frustumCulled={false} />;
}

export default FireEffect;
