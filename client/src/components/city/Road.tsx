import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { BuildingLayout, RoadLayout, Vec3 } from '../../types/layout';
import { useLOD } from '../../hooks/useLOD';
import { branchCurve } from '../../layout/roadCurves';

/**
 * Service roads (FR-026): each service branch rendered as a flat ShapeGeometry
 * strip. ShapeGeometry is N8AO-safe (unlike the previous TubeGeometry approach).
 * Multiple shapes passed to one ShapeGeometry constructor become one draw call.
 */

const ROAD_SEGMENTS = 10;
const ROAD_TILE = 8.5; // world units per texture tile

function buildRoadGeometry(road: RoadLayout, posById: Map<string, Vec3>): THREE.BufferGeometry | null {
  const anchor = road.pathPoints[0];
  if (!anchor) return null;
  const halfW = road.width / 2;
  const shapes: THREE.Shape[] = [];

  for (const uid of road.podUids) {
    const to = posById.get(uid);
    if (!to) continue;
    const curve = branchCurve(anchor, to);
    const pts = curve.getPoints(ROAD_SEGMENTS);

    const left: THREE.Vector2[] = [];
    const right: THREE.Vector2[] = [];

    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const p = pts[i];
      // ShapeGeometry rotateX(-π/2) maps shape Y → world -Z, so negate Z here
      // to cancel: shape(x, -pz) → world (x, 0, pz).
      left.push(new THREE.Vector2(p.x + nx * halfW, -(p.z + nz * halfW)));
      right.push(new THREE.Vector2(p.x - nx * halfW, -(p.z - nz * halfW)));
    }

    const shape = new THREE.Shape();
    shape.moveTo(left[0].x, left[0].y);
    for (const v of left) shape.lineTo(v.x, v.y);
    for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i].x, right[i].y);
    shape.closePath();
    shapes.push(shape);
  }

  if (shapes.length === 0) return null;

  const geom = new THREE.ShapeGeometry(shapes);
  geom.rotateX(-Math.PI / 2);
  // World-space UVs so the texture tiles at a consistent real-world scale
  // regardless of shape bounding box size (same technique as terrain grass).
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2]     =  pos.getX(i) / ROAD_TILE;
    uv[i * 2 + 1] = -pos.getZ(i) / ROAD_TILE;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

function RoadsInner({
  geometries,
}: {
  geometries: { uid: string; geom: THREE.BufferGeometry }[];
}) {
  const pathMap = useTexture('/textures/T_Path.png');

  const roadMaterial = useMemo(() => {
    pathMap.wrapS = pathMap.wrapT = THREE.RepeatWrapping;
    pathMap.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: pathMap });
  }, [pathMap]);

  return (
    <>
      {geometries.map(({ uid, geom }) => (
        <mesh key={uid} geometry={geom} material={roadMaterial} receiveShadow position={[0, 1.35, 0]} />
      ))}
    </>
  );
}

export function Roads({
  roads,
  buildings,
}: {
  roads: RoadLayout[];
  buildings: BuildingLayout[];
}) {
  const lod = useLOD();

  const geometries = useMemo(() => {
    const posById = new Map(buildings.map((b) => [b.resourceId, b.position]));
    const result = roads
      .map((r) => ({ uid: r.serviceUid, geom: buildRoadGeometry(r, posById) }))
      .filter((x): x is { uid: string; geom: THREE.BufferGeometry } => x.geom !== null);
    return result;
  }, [roads, buildings]);

  if (lod === 'far') return null;

  return <RoadsInner geometries={geometries} />;
}

export default Roads;
