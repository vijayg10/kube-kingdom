import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * Atmospheric chimney smoke + road dust (T068).
 * Capped particle pool: up to 60 smoke puffs above pod-houses, driven by a
 * pooled InstancedMesh so cost is constant regardless of pod count.
 */
const MAX_SMOKE = 60;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function hashN(s: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return ((h * (n + 1)) >>> 0) % 100;
}

type SmokeParticle = {
  x: number;
  z: number;
  yBase: number;
  phase: number;
  speed: number;
};

export function Atmosphere({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const ref = useRef<THREE.InstancedMesh>(null);

  const pods = useMemo(
    () => buildings.filter((b) => b.resourceType === 'pod').slice(0, MAX_SMOKE),
    [buildings],
  );

  const particles = useMemo<SmokeParticle[]>(
    () =>
      pods.map((b) => ({
        x: b.position.x,
        z: b.position.z,
        yBase: 3.8, // chimney tip height
        phase: (hashN(b.resourceId, 0) / 100) * Math.PI * 2,
        speed: 0.18 + (hashN(b.resourceId, 1) / 100) * 0.22,
      })),
    [pods],
  );

  const geom = useMemo(() => new THREE.SphereGeometry(0.55, 5, 4), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d0c8b8',
        transparent: true,
        opacity: 0.22,
        roughness: 1,
        depthWrite: false,
      }),
    [],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh || lod === 'far') {
      if (mesh) mesh.count = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    let i = 0;
    for (const p of particles) {
      const localT = (t * p.speed + p.phase) % 1;
      const y = p.yBase + localT * 3.5;
      const drift = Math.sin(t * 0.6 + p.phase) * 0.4;
      const scale = 0.5 + localT * 0.9;
      _p.set(p.x + drift, y, p.z);
      _s.setScalar(scale);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      i++;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    // Drive opacity via material (single value — all particles share the same fade feel)
    (mesh.material as THREE.MeshStandardMaterial).opacity = 0.18;
  });

  if (lod === 'far') return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geom, mat, MAX_SMOKE]}
      frustumCulled={false}
    />
  );
}

export default Atmosphere;
