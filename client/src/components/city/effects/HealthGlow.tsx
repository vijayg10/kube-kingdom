import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';

export interface GlowSite {
  pos: Vec3;
  color: THREE.Color;
}

/**
 * Pulsing ground glow beneath unhealthy pods — an at-a-glance health cue
 * (constitution Principle IV). Instanced emissive discs; pulse animated in
 * useFrame. Per-instance color carries the health color.
 */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

export function HealthGlow({ sites }: { sites: GlowSite[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = sites.length;
  const geom = useMemo(() => new THREE.CircleGeometry(2.2, 20), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh || count === 0) return;
    const t = state.clock.elapsedTime;
    sites.forEach((site, i) => {
      const pulse = 0.85 + Math.sin(t * 4 + i) * 0.25;
      _p.set(site.pos.x, 0.12, site.pos.z);
      _q.copy(FLAT);
      _s.setScalar(pulse);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, site.color);
    });
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geom, mat, count]} frustumCulled={false} />;
}

export default HealthGlow;
