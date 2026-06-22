import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingLayout, RoadLayout, Vec3 } from '../../../types/layout';
import { useClusterStore } from '../../../store/clusterStore';
import { useLOD } from '../../../hooks/useLOD';
import { isIncident } from '../traffic/trafficState';

/**
 * Incident mode (US4, FR-018): when a service's error rate spikes, its backing
 * pod-houses and service anchor pulse with a red glow, marking the failure and
 * its immediate blast radius. Pooled instanced discs, positioned each frame from
 * the live traffic feed.
 */
const MAX = 120;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const RED = new THREE.Color('#ff2a18');

export function Incident({
  roads,
  buildings,
}: {
  roads: RoadLayout[];
  buildings: BuildingLayout[];
}) {
  const lod = useLOD();
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new THREE.CircleGeometry(2.6, 20), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: RED,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  const posById = useMemo(
    () => new Map(buildings.map((b) => [b.resourceId, b.position])),
    [buildings],
  );
  const anchorByService = useMemo(() => {
    const m = new Map<string, Vec3>();
    for (const r of roads) if (r.pathPoints[0]) m.set(r.serviceUid, r.pathPoints[0]);
    return m;
  }, [roads]);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const traffic = useClusterStore.getState().traffic;
    const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 6) * 0.3;
    let i = 0;
    const place = (pos: Vec3, scale: number) => {
      if (i >= MAX) return;
      _p.set(pos.x, 0.14, pos.z);
      _s.setScalar(scale * pulse);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      i++;
    };
    for (const road of roads) {
      if (!isIncident(traffic.get(road.serviceUid))) continue;
      const anchor = anchorByService.get(road.serviceUid);
      if (anchor) place(anchor, 1.6);
      for (const uid of road.podUids) {
        const p = posById.get(uid);
        if (p) place(p, 1);
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (lod === 'far') return null;
  return <instancedMesh ref={ref} args={[geom, mat, MAX]} frustumCulled={false} />;
}

export default Incident;
