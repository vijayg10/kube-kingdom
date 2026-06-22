import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';

/**
 * Pooled rising smoke for crashing pods (PROMPT health table, FR-011).
 * A fixed pool of instanced billboard puffs per site; each puff rises and
 * fades on a looping timer. Capped pool keeps GPU cost bounded (research.md §2).
 */
const PUFFS_PER_SITE = 4;
const RISE = 3.2; // units a puff rises over its life
const LIFE = 2.6; // seconds

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export function SmokeParticles({ sites }: { sites: Vec3[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = sites.length * PUFFS_PER_SITE;
  const geom = useMemo(() => new THREE.IcosahedronGeometry(0.4, 0), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#444',
        transparent: true,
        opacity: 0.5,
        roughness: 1,
        depthWrite: false,
      }),
    [],
  );

  useFrame((state, _dt, frame) => {
    void frame;
    const mesh = ref.current;
    if (!mesh || count === 0) return;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (const site of sites) {
      for (let k = 0; k < PUFFS_PER_SITE; k++) {
        const life = ((t + (k / PUFFS_PER_SITE) * LIFE) % LIFE) / LIFE; // 0..1
        const y = 4.2 + life * RISE;
        const grow = 0.4 + life * 1.1;
        _p.set(site.x + Math.sin(life * 6 + i) * 0.3, y, site.z + Math.cos(life * 5 + i) * 0.3);
        _q.identity();
        _s.setScalar(grow);
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

export default SmokeParticles;
