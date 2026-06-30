import * as THREE from 'three';
import type { BuildingLayout, RoadLayout, Vec3 } from '../types/layout';
import { hashString } from './seededRandom';

/**
 * A gently-bent road branch from a service anchor to one pod-house. Shared by
 * the Road renderer and the Traffic system so carts ride the exact road paths.
 */
// Above the maximum terrain terrace height (hilltop = 1.30) so roads and
// carts are never occluded by the terrain cap polygons.
const ROAD_Y = 1.35;

export function branchCurve(from: Vec3, to: Vec3): THREE.CatmullRomCurve3 {
  const mid = new THREE.Vector3((from.x + to.x) / 2, ROAD_Y, (from.z + to.z) / 2);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  // Seed bend side + magnitude from the endpoint so branches don't all bow the
  // same way (which produced a uniform pinwheel). Each road curves differently.
  const h = hashString(`bend:${to.x.toFixed(1)},${to.z.toFixed(1)}`);
  const sign = h & 1 ? 1 : -1;
  const mag = 0.1 + ((h >>> 1) % 100) / 100 * 0.16; // 0.10–0.26
  const bend = Math.min(len * mag, 7) * sign;
  mid.x += nx * bend;
  mid.z += nz * bend;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(from.x, ROAD_Y, from.z),
    mid,
    new THREE.Vector3(to.x, ROAD_Y, to.z),
  ]);
}

export interface RoadLane {
  serviceUid: string;
  curve: THREE.CatmullRomCurve3;
}

/**
 * Flatten roads into individual lanes (one per service→pod branch), capped for
 * performance. Used to spawn traffic units.
 */
export function buildRoadLanes(
  roads: RoadLayout[],
  buildings: BuildingLayout[],
  maxPerRoad = 3,
  maxTotal = 48,
): RoadLane[] {
  const posById = new Map(buildings.map((b) => [b.resourceId, b.position]));
  const lanes: RoadLane[] = [];
  for (const road of roads) {
    const anchor = road.pathPoints[0];
    if (!anchor) continue;
    let n = 0;
    for (const uid of road.podUids) {
      if (n >= maxPerRoad || lanes.length >= maxTotal) break;
      const to = posById.get(uid);
      if (!to) continue;
      lanes.push({ serviceUid: road.serviceUid, curve: branchCurve(anchor, to) });
      n++;
    }
    if (lanes.length >= maxTotal) break;
  }
  return lanes;
}
