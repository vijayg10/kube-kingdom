import type { ClusterState, KubeService, Pod } from '../types/cluster';
import type { BuildingResourceType } from '../types/layout';
import type {
  BuildingLayout,
  CityLayout,
  DecorItem,
  DistrictLayout,
  HamletLayout,
  IslandLayout,
  PropsLayout,
  RoadLayout,
  TerrainLayout,
  Vec3,
} from '../types/layout';
import * as THREE from 'three';
import { hashString, mulberry32, rngFor } from './seededRandom';

// LOD thresholds (camera distance units): [far→mid, mid→close]. research.md §2.
const POD_LOD: [number, number] = [80, 20];
const NODE_LOD: [number, number] = [140, 45];
const EXT_LOD: [number, number] = [120, 40];

// District color per theme (minimap + district glow).
const THEME_COLOR: Record<string, string> = {
  citadel: '#caa64a',
  production: '#9c5a4a',
  staging: '#5a7a9c',
  development: '#6b9c5a',
  default: '#8a7a9c',
};

function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/**
 * Build an irregular polygon (medieval-quarter feel) around a center.
 * Vertex radii are jittered deterministically from the namespace name.
 */
function districtPolygon(center: Vec3, radius: number, seed: string): Vec3[] {
  const rng = rngFor('poly:' + seed);
  const sides = 7 + Math.floor(rng() * 4); // 7–10 sides
  const verts: Vec3[] = [];
  for (let i = 0; i < sides; i++) {
    const baseAngle = (i / sides) * Math.PI * 2;
    // Jitter angle ±40% of a sector so vertices aren't evenly spaced
    const a = baseAngle + (rng() - 0.5) * (Math.PI / sides) * 0.8;
    // Wider radius jitter for more organic outlines (was 0.78–1.12)
    const jitter = 0.58 + rng() * 0.58;
    verts.push(v3(center.x + Math.cos(a) * radius * jitter, 0, center.z + Math.sin(a) * radius * jitter));
  }
  return verts;
}

// Terrain terrace heights mirror Terrain.tsx TERRACES × 1.3 island expansion.
// Island polygon = wallVertices × 1.3; terraces scale that polygon further.
const TERRACE_RINGS = [
  { scale: 1.3 * 0.37, y: 1.30 }, // hilltop — check innermost first
  { scale: 1.3 * 0.68, y: 0.65 }, // mid slope
  { scale: 1.3 * 1.00, y: 0.00 }, // shore
];

function pointInPolygon2D(px: number, pz: number, verts: Vec3[]): boolean {
  let inside = false;
  const n = verts.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = verts[i].x, zi = verts[i].z;
    const xj = verts[j].x, zj = verts[j].z;
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function terrainHeightAt(px: number, pz: number, district: DistrictLayout): number {
  for (const { scale, y } of TERRACE_RINGS) {
    const scaled = district.wallVertices.map((v) => ({
      x: district.center.x + (v.x - district.center.x) * scale,
      y: 0,
      z: district.center.z + (v.z - district.center.z) * scale,
    }));
    if (pointInPolygon2D(px, pz, scaled)) return y;
  }
  return 0;
}

/** Stable position for a building inside a disk, derived purely from its id. */
function stableDiskPosition(id: string, center: Vec3, radius: number): Vec3 {
  const h = hashString(id);
  const rand = mulberry32(h);
  const angle = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * radius; // sqrt → uniform disk distribution
  return v3(center.x + Math.cos(angle) * r, 0, center.z + Math.sin(angle) * r);
}

// --- Island-shape-aware placement -----------------------------------------
// Trees and extended resources sit in the shore ring near the island edge.
// The island is irregular (and smoothed by Terrain.tsx), so a circular radius
// overshoots the real shore in the pinched directions → props on water. These
// helpers place/clamp against the island's ACTUAL rendered outline instead.
const ISLAND_EXPANSION = 1.3;    // must match buildTerrain
const ISLAND_SMOOTH_SAMPLES = 72; // must match Terrain.tsx smoothPolygon

/** Catmull-Rom smoothing identical to Terrain.tsx, so placement == rendered shore. */
function smoothClosed(verts: Vec3[]): Vec3[] {
  if (verts.length < 3) return verts;
  const pts = verts.map((v) => new THREE.Vector3(v.x, 0, v.z));
  return new THREE.CatmullRomCurve3(pts, true)
    .getPoints(ISLAND_SMOOTH_SAMPLES)
    .map((p) => ({ x: p.x, y: 0, z: p.z }));
}

/** The rendered island (grass) outline for a district. */
function islandPolyFor(d: DistrictLayout): Vec3[] {
  const grown = d.wallVertices.map((v) =>
    v3(
      d.center.x + (v.x - d.center.x) * ISLAND_EXPANSION,
      0,
      d.center.z + (v.z - d.center.z) * ISLAND_EXPANSION,
    ),
  );
  return smoothClosed(grown);
}

/** Distance from `center` to the polygon edge along `angle` (nearest ray hit). */
function edgeRadiusAt(center: Vec3, poly: Vec3[], angle: number): number {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x, ez = b.z - a.z;
    const det = ex * dz - dx * ez;
    if (Math.abs(det) < 1e-9) continue; // ray parallel to edge
    const acx = a.x - center.x, acz = a.z - center.z;
    const t = (ex * acz - ez * acx) / det;
    const s = (dx * acz - dz * acx) / det;
    if (t >= 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.min(best, t);
  }
  return Number.isFinite(best) ? best : 0;
}

/** Pull a position inside the island (to edge − margin) if it sits beyond it. */
function clampInsideIsland(pos: Vec3, center: Vec3, poly: Vec3[], margin: number): Vec3 {
  const dx = pos.x - center.x, dz = pos.z - center.z;
  const rp = Math.hypot(dx, dz);
  if (rp < 1e-6) return pos;
  const maxR = Math.max(0, edgeRadiusAt(center, poly, Math.atan2(dz, dx)) - margin);
  if (rp <= maxR) return pos;
  const k = maxR / rp;
  return v3(center.x + dx * k, pos.y, center.z + dz * k);
}

/** Grid slot for index i out of total items, centered on parent, with given spacing. */
function gridSlot(index: number, total: number, center: Vec3, spacing: number): Vec3 {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rows = Math.ceil(total / cols);
  return v3(
    center.x + (col - (cols - 1) / 2) * spacing,
    0,
    center.z + (row - (rows - 1) / 2) * spacing,
  );
}

export function generateCityLayout(state: ClusterState): CityLayout {
  const districts: DistrictLayout[] = [];
  const buildings: BuildingLayout[] = [];
  const roads: RoadLayout[] = [];

  // --- Districts -----------------------------------------------------------
  // kube-system pinned to center; remaining namespaces ring around it, sized
  // by pod count (constitution Principle II: citadel always central).
  const podsByNs = new Map<string, Pod[]>();
  for (const p of state.pods) {
    const arr = podsByNs.get(p.namespace) ?? [];
    arr.push(p);
    podsByNs.set(p.namespace, arr);
  }

  const central = state.namespaces.find((n) => n.name === 'kube-system');
  const ring = state.namespaces
    .filter((n) => n.name !== 'kube-system')
    .sort((a, b) => a.name.localeCompare(b.name)); // stable order

  const radiusFor = (ns: string) => {
    const count = podsByNs.get(ns)?.length ?? 0;
    return Math.max(18, 16 + Math.sqrt(count) * 6);
  };

  const ringRadius = 70 + ring.length * 8;

  const placeDistrict = (name: string, center: Vec3, theme: DistrictLayout['theme']) => {
    const r = radiusFor(name);
    districts.push({
      namespace: name,
      center,
      radius: r,
      wallVertices: districtPolygon(center, r, name),
      color: THEME_COLOR[theme] ?? THEME_COLOR.default,
      theme,
    });
  };

  if (central) placeDistrict(central.name, v3(0, 0, 0), central.theme);
  ring.forEach((ns, i) => {
    const a = (i / Math.max(1, ring.length)) * Math.PI * 2;
    placeDistrict(ns.name, v3(Math.cos(a) * ringRadius, 0, Math.sin(a) * ringRadius), ns.theme);
  });

  const districtByNs = new Map(districts.map((d) => [d.namespace, d]));
  // Actual rendered island outline per namespace, for shape-aware placement.
  const islandPolyByNs = new Map(districts.map((d) => [d.namespace, islandPolyFor(d)]));
  const polyFor = (ns: string) => islandPolyByNs.get(ns) ?? [];

  // --- Hamlets (deployments) + pod houses ---------------------------------
  // Pods are grouped into deployment "hamlets" (SC-006) so deployments read as
  // distinct clusters and districts feel populated. Hamlet centers are stable
  // (derived from the deployment name); pod slots are stable (from pod UID).
  const hamlets: HamletLayout[] = [];
  for (const d of districts) {
    const pods = podsByNs.get(d.namespace) ?? [];
    const byDep = new Map<string, Pod[]>();
    for (const p of pods) {
      const key = p.deploymentName ?? 'standalone';
      const arr = byDep.get(key) ?? [];
      arr.push(p);
      byDep.set(key, arr);
    }
    const depNames = [...byDep.keys()].sort();
    const islandPoly = islandPolyByNs.get(d.namespace) ?? islandPolyFor(d);
    // Hamlet grid spacing must shrink as the deployment count grows so the whole
    // grid (plus each hamlet's pod sub-grid) fits the island instead of spilling
    // past its pinched edges into the water.
    const footprint = (p: number) => ((Math.ceil(Math.sqrt(Math.max(1, p))) - 1) / 2) * 5.5 + 3;
    const maxFoot = Math.max(...depNames.map((dn) => footprint(byDep.get(dn)!.length)));
    const cols = Math.max(1, Math.ceil(Math.sqrt(depNames.length)));
    const innerR = d.radius * 0.62; // keep the grid well inside the shore
    const fitSpacing = cols > 1 ? (2 * (innerR - maxFoot)) / (cols - 1) : 0;
    const hamletSpacing = Math.max(2 * maxFoot + 2, Math.min(16, fitSpacing));
    depNames.forEach((dep, i) => {
      const depPods = byDep.get(dep)!;
      // Hamlet centers on a grid inside the district.
      const hCenter = gridSlot(i, depNames.length, d.center, hamletSpacing);
      const hRadius = Math.max(3.5, Math.sqrt(depPods.length) * 3.2);
      hamlets.push({ deploymentName: dep, namespace: d.namespace, center: hCenter, radius: hRadius });

      // Pod-houses on a tight grid inside each hamlet; sorted for stable assignment.
      const sortedPods = [...depPods].sort((a, b) => a.uid.localeCompare(b.uid));
      const POD_SPACING = 5.5;
      sortedPods.forEach((pod, idx) => {
        // Break the rigid lattice with a seeded offset (~35% of spacing) so the
        // hamlet reads as an organic cluster rather than a parking grid.
        const jr = mulberry32(hashString(pod.uid + ':jit'));
        const jmax = POD_SPACING * 0.35;
        const slot = gridSlot(idx, sortedPods.length, hCenter, POD_SPACING);
        const raw = v3(slot.x + (jr() - 0.5) * 2 * jmax, 0, slot.z + (jr() - 0.5) * 2 * jmax);
        const position = clampInsideIsland(raw, d.center, islandPoly, 4);
        // Face the road: service roads arrive from the district center, so orient
        // the house toward it (same convention as nodes) + a small ±8° jitter,
        // replacing the previous fully-random yaw that looked chaotic.
        const toCenter = Math.atan2(d.center.z - position.z, d.center.x - position.x);
        const yawJitter = ((hashString(pod.uid + ':yaw') % 17) - 8) * (Math.PI / 180);
        buildings.push({
          resourceId: pod.uid,
          resourceType: 'pod',
          position,
          rotationY: toCenter + yawJitter,
          namespace: pod.namespace,
          lodDistances: POD_LOD,
        });
      });
    });
  }

  // --- Node landmarks ------------------------------------------------------
  // Nodes host pods cluster-wide. Placed in the open ring between the central
  // citadel and the outer districts so they read as visible landmarks.
  const nodeRadius = ringRadius * 0.52;
  state.nodes.forEach((node, i) => {
    const a = (i / Math.max(1, state.nodes.length)) * Math.PI * 2 + Math.PI / state.nodes.length;
    buildings.push({
      resourceId: node.name,
      resourceType: 'node',
      position: v3(Math.cos(a) * nodeRadius, 0, Math.sin(a) * nodeRadius),
      rotationY: Math.atan2(-Math.sin(a), -Math.cos(a)), // face the city center
      namespace: '',
      lodDistances: NODE_LOD,
    });
  });

  // --- Extended resources (US6) -------------------------------------------
  // Each resource type maps to a city counterpart. Placed deterministically
  // in its namespace district or at district boundaries.

  const placeExt = (id: string, type: BuildingResourceType, ns: string, meta?: Record<string, unknown>) => {
    const d = districtByNs.get(ns) ?? districts[0];
    if (!d) return;
    buildings.push({
      resourceId: id,
      resourceType: type,
      position: clampInsideIsland(
        stableDiskPosition(id + ':ext', d.center, d.radius * 1.08), d.center, polyFor(d.namespace), 2.5,
      ),
      rotationY: (hashString(id + ':rot') % 360) * (Math.PI / 180),
      namespace: ns,
      lodDistances: EXT_LOD,
      meta,
    });
  };

  for (const ing of state.ingresses) {
    // Ingress → city gate: placed at district boundary (slightly outside).
    const d = districtByNs.get(ing.namespace);
    if (d) {
      const a = (hashString(ing.uid) % 360) * (Math.PI / 180);
      buildings.push({
        resourceId: ing.uid,
        resourceType: 'ingress',
        position: clampInsideIsland(
          v3(d.center.x + Math.cos(a) * (d.radius + 4), 0, d.center.z + Math.sin(a) * (d.radius + 4)),
          d.center, polyFor(ing.namespace), 2,
        ),
        rotationY: a + Math.PI, // face inward
        namespace: ing.namespace,
        lodDistances: EXT_LOD,
        meta: { hosts: ing.hosts },
      });
    }
  }

  for (const lb of state.loadBalancers) {
    placeExt(lb.uid, 'loadbalancer', lb.namespace, { externalIP: lb.externalIP });
  }

  for (const ss of state.statefulSets) {
    placeExt(ss.uid, 'statefulset', ss.namespace, { replicas: ss.replicas, name: ss.name });
  }

  for (const ds of state.daemonSets) {
    placeExt(ds.uid, 'daemonset', ds.namespace, { name: ds.name });
  }

  for (const job of state.jobs) {
    placeExt(job.uid, 'job', job.namespace, { state: job.state, kind: job.kind, name: job.name });
  }

  for (const pv of state.persistentVolumes) {
    placeExt(pv.uid, 'pv', pv.namespace, { capacityGiB: pv.capacityGiB, phase: pv.phase });
  }

  for (const hpa of state.hpas) {
    placeExt(hpa.uid, 'hpa', hpa.namespace, { target: hpa.targetDeployment, min: hpa.minReplicas, max: hpa.maxReplicas });
  }

  for (const cm of state.configMaps) {
    placeExt(cm.uid, 'configmap', cm.namespace, { keys: cm.keys });
  }

  for (const sec of state.secrets) {
    const d = districtByNs.get(sec.namespace) ?? districts[0];
    if (!d) continue;
    const pos = clampInsideIsland(
      stableDiskPosition(sec.uid + ':ext', d.center, d.radius * 1.08), d.center, polyFor(sec.namespace), 2.5,
    );
    buildings.push({
      resourceId: sec.uid,
      resourceType: 'secret',
      position: { ...pos, y: terrainHeightAt(pos.x, pos.z, d) },
      rotationY: (hashString(sec.uid + ':rot') % 360) * (Math.PI / 180),
      namespace: sec.namespace,
      lodDistances: EXT_LOD,
      meta: { keys: sec.keys },
    });
  }

  const nodePositions = buildings.filter((b) => b.resourceType === 'node').map((b) => b.position);

  // --- Service roads (FR-026: each service → its backing pod-houses) --------
  for (const svc of state.services) {
    const podUids = backingPods(svc, state.pods);
    if (podUids.length === 0) continue;
    const d = districtByNs.get(svc.namespace);
    const anchor = d ? d.center : v3(0, 0, 0);
    roads.push({
      serviceUid: svc.uid,
      podUids,
      pathPoints: [anchor], // road origin; branch endpoints resolved from pod positions
      width: svc.type === 'LoadBalancer' ? 2.4 : 1.6,
    });
  }

  // --- Terrain + props -----------------------------------------------------
  const terrain = buildTerrain(districts, nodePositions);
  const props = buildProps(districts, hamlets, terrain, islandPolyByNs);

  return {
    terrain,
    districts,
    hamlets,
    buildings,
    roads,
    props,
    generatedAt: new Date().toISOString(),
  };
}

// Per-model scale so the (tiny) Quaternius props sit at the right size.
const DECOR_SCALE: Record<string, number> = {
  Well: 2.4,
  MarketStand_1: 2.6,
  Cart: 2.6,
  Barrel: 4,
  Fence: 4,
  Bonfire_Lit: 3.5,
  Crate: 4.5,
  Hay: 4.5,
  Rock_1: 4,
};

/** Deterministic trees + lamp posts + medieval decor that dress the diorama. */
function buildProps(
  districts: DistrictLayout[],
  hamlets: HamletLayout[],
  _terrain: TerrainLayout,
  islandPolyByNs: Map<string, Vec3[]>,
): PropsLayout {
  const trees: Vec3[] = [];
  const lamps: Vec3[] = [];
  const decor: DecorItem[] = [];
  const groundCover: Vec3[] = [];

  const addDecor = (model: string, pos: Vec3, rotationY: number) =>
    decor.push({ model, position: pos, rotationY, scale: DECOR_SCALE[model] ?? 2 });

  for (const d of districts) {
    const islandPoly = islandPolyByNs.get(d.namespace) ?? islandPolyFor(d);
    // Lamp posts at alternating district wall vertices.
    d.wallVertices.forEach((v, i) => {
      if (i % 2 === 0) lamps.push(v3(v.x, 0, v.z));
    });
    // A ring of trees near the shore, clamped to the island's real outline.
    const treeRing = Math.floor(d.radius / 2.2);
    for (let i = 0; i < treeRing; i++) {
      const a = (i / treeRing) * Math.PI * 2 + (hashString(d.namespace) % 100) / 100;
      const rawR = d.radius + 3.5 + ((hashString(d.namespace + i) % 100) / 100) * 2;
      const p = v3(d.center.x + Math.cos(a) * rawR, 0, d.center.z + Math.sin(a) * rawR);
      trees.push(clampInsideIsland(p, d.center, islandPoly, 1.5));
    }

    // Medieval decor scattered within the district.
    const rng = mulberry32(hashString(d.namespace + ':decor'));
    const spot = (frac: number): [Vec3, number] => {
      const a = rng() * Math.PI * 2;
      const r = rng() * d.radius * frac;
      return [v3(d.center.x + Math.cos(a) * r, 0, d.center.z + Math.sin(a) * r), rng() * Math.PI * 2];
    };
    // Central focal point: bonfire in the citadel, well elsewhere.
    if (d.theme === 'citadel') addDecor('Bonfire_Lit', d.center, 0);
    {
      const [p, ry] = spot(0.45);
      addDecor('Well', p, ry);
    }
    {
      const [p, ry] = spot(0.55);
      addDecor('MarketStand_1', p, ry);
    }
    {
      const [p, ry] = spot(0.6);
      addDecor('Cart', p, ry);
    }
    // Clusters of small goods near random spots.
    for (let i = 0; i < 4; i++) {
      const [base] = spot(0.7);
      const kind = ['Barrel', 'Crate', 'Hay', 'Rock_1'][i % 4];
      const n = 1 + Math.floor(rng() * 3);
      for (let j = 0; j < n; j++) {
        addDecor(
          kind,
          v3(base.x + (rng() - 0.5) * 2.5, 0, base.z + (rng() - 0.5) * 2.5),
          rng() * Math.PI * 2,
        );
      }
    }
    // Fence segments along two outer wall edges.
    for (let i = 0; i < d.wallVertices.length; i++) {
      if (i % 3 !== 0) continue;
      const a = d.wallVertices[i];
      const b = d.wallVertices[(i + 1) % d.wallVertices.length];
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const inward = 2.2;
      const dirToCenter = Math.atan2(d.center.z - mz, d.center.x - mx);
      addDecor(
        'Fence',
        v3(mx + Math.cos(dirToCenter) * inward, 0, mz + Math.sin(dirToCenter) * inward),
        Math.atan2(b.z - a.z, b.x - a.x),
      );
    }
  }

  // A few barrels/crates beside each hamlet for lived-in feel.
  for (const h of hamlets) {
    const rng = mulberry32(hashString(h.namespace + h.deploymentName + ':goods'));
    const a = rng() * Math.PI * 2;
    const p = v3(h.center.x + Math.cos(a) * (h.radius + 1), 0, h.center.z + Math.sin(a) * (h.radius + 1));
    addDecor(rng() > 0.5 ? 'Hay' : 'Barrel', p, rng() * Math.PI * 2);
  }

  // Scatter trees and rocks on the island shore of each district (the ring
  // between the district wall and the island edge). Ocean areas get no props.
  for (const d of districts) {
    const islandPoly = islandPolyByNs.get(d.namespace) ?? islandPolyFor(d);
    const islandR = d.radius * 1.28; // matches the 1.3 expansion in buildTerrain
    const shoreInner = d.radius + 1;
    const shoreOuter = islandR - 0.5;
    if (shoreOuter <= shoreInner) continue;
    const rng = mulberry32(hashString('shore:' + d.namespace));
    const count = Math.max(4, Math.floor(d.radius / 2.5));
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = shoreInner + rng() * (shoreOuter - shoreInner);
      const p = clampInsideIsland(
        v3(d.center.x + Math.cos(a) * r, 0, d.center.z + Math.sin(a) * r), d.center, islandPoly, 1,
      );
      if (rng() > 0.88) addDecor('Rock_1', p, rng() * Math.PI * 2);
      else trees.push(p);
    }
  }

  // Dense ground cover (grass, bushes, plants) scattered across each island.
  for (const d of districts) {
    const islandPoly = islandPolyByNs.get(d.namespace) ?? islandPolyFor(d);
    const islandR = d.radius * 1.28;
    const rng = mulberry32(hashString('gc:' + d.namespace));
    const count = Math.floor(d.radius * 4);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * islandR * 0.95;
      const p = clampInsideIsland(
        v3(d.center.x + Math.cos(a) * r, 0, d.center.z + Math.sin(a) * r), d.center, islandPoly, 0.5,
      );
      groundCover.push(p);
    }
  }

  return { trees, lamps, decor, groundCover };
}

/** Pods a service selects, via label-selector match (FR-026). */
function backingPods(svc: KubeService, pods: Pod[]): string[] {
  const sel = Object.entries(svc.selector);
  if (sel.length === 0) return [];
  return pods
    .filter(
      (p) =>
        p.namespace === svc.namespace && sel.every(([k, v]) => p.labels[k] === v),
    )
    .map((p) => p.uid);
}

function buildTerrain(districts: DistrictLayout[], nodePositions: Vec3[]): TerrainLayout {
  // Bounds enclose all districts with margin.
  let maxR = 60;
  for (const d of districts) {
    const reach = Math.hypot(d.center.x, d.center.z) + d.radius;
    maxR = Math.max(maxR, reach);
  }
  const span = maxR + 60;

  const islands: IslandLayout[] = [];

  // One island per namespace: polygon expanded 30% beyond the district walls so
  // the shore ring is visible outside the city boundary.
  for (const d of districts) {
    const vertices = d.wallVertices.map((vv) => ({
      x: d.center.x + (vv.x - d.center.x) * 1.3,
      y: 0,
      z: d.center.z + (vv.z - d.center.z) * 1.3,
    }));
    islands.push({ namespace: d.namespace, vertices, center: d.center });
  }

  // Small octagonal platform island for each node (nodes sit in open water
  // between namespace islands, so they need their own land mass).
  nodePositions.forEach((pos, i) => {
    const r = 7;
    const platformRng = mulberry32(hashString(`node-platform:${i}`));
    const verts: Vec3[] = [];
    for (let j = 0; j < 8; j++) {
      const baseA = (j / 8) * Math.PI * 2;
      const a = baseA + (platformRng() - 0.5) * (Math.PI / 8) * 0.7;
      const rv = r * (0.72 + platformRng() * 0.46);
      verts.push(v3(pos.x + Math.cos(a) * rv, 0, pos.z + Math.sin(a) * rv));
    }
    islands.push({ namespace: '', nodeId: `node-${i}`, vertices: verts, center: pos, isNodePlatform: true });
  });

  return {
    tiles: [],
    waterFeatures: [], // ocean is now the base — no separate pond polygons needed
    islands,
    bounds: { min: v3(-span, 0, -span), max: v3(span, 0, span) },
  };
}
