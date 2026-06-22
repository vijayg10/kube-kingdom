import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';

/**
 * Distinct geometry for non-running pod states (PROMPT health table, FR-011):
 *  - Pending  → construction scaffolding (timber frame around the house)
 *  - Evicted  → ruin (broken, leaning rubble)
 *
 * Uses only BoxGeometry — no mergeGeometries (which produces a raw BufferGeometry
 * that corrupts N8AO's depth pre-pass on fresh page load).
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();

// Scaffold: 4 corner posts as one InstancedMesh (each instance = one post,
// positioned relative to its pod site via matrix).
const postGeom = new THREE.BoxGeometry(0.12, 1.8, 0.12);
const ruinGeom = new THREE.BoxGeometry(0.7, 0.45, 0.7);


const CORNER_OFFSETS: [number, number][] = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];

export function Scaffolding({ sites }: { sites: Vec3[] }) {
  const postRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = postRef.current;
    if (!mesh) return;
    let k = 0;
    for (const site of sites) {
      for (const [ox, oz] of CORNER_OFFSETS) {
        _p.set(site.x + ox, 0.9, site.z + oz);
        _q.identity();
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(k++, _m);
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [sites]);

  if (sites.length === 0) return null;
  return (
    <instancedMesh ref={postRef} args={[postGeom, undefined, sites.length * 4]} castShadow>
      <meshStandardMaterial color="#a9824e" roughness={1} />
    </instancedMesh>
  );
}

const rng = (seed: number) => Math.sin(seed * 99.1) * 0.5 + 0.5;
const RUIN_OFFSETS = Array.from({ length: 5 }, (_, i) => ({
  ox: (rng(i) - 0.5) * 1.4,
  oy: 0.2 + rng(i + 5) * 0.2,
  oz: (rng(i + 7) - 0.5) * 1.4,
  sx: 0.4 + rng(i) * 0.5,
  sy: 0.3 + rng(i + 9) * 0.4,
  sz: 0.4 + rng(i + 3) * 0.5,
  ry: rng(i) * Math.PI,
}));

export function Ruin({ sites }: { sites: Vec3[] }) {
  const ruinRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ruinRef.current;
    if (!mesh) return;
    let k = 0;
    for (const site of sites) {
      for (const o of RUIN_OFFSETS) {
        _p.set(site.x + o.ox, o.oy, site.z + o.oz);
        _q.setFromEuler(new THREE.Euler(0, o.ry, 0));
        _s.set(o.sx, o.sy, o.sz);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(k++, _m);
      }
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    _s.set(1, 1, 1); // reset
    mesh.computeBoundingSphere();
  }, [sites]);

  if (sites.length === 0) return null;
  return (
    <instancedMesh ref={ruinRef} args={[ruinGeom, undefined, sites.length * 5]} castShadow>
      <meshStandardMaterial color="#3a342e" roughness={1} />
    </instancedMesh>
  );
}
