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
    // Spacing between hamlet centers — shrinks for many deployments so they fit the district.
    const hamletSpacing = Math.min(d.radius * 0.7, 16);
    depNames.forEach((dep, i) => {
      const depPods = byDep.get(dep)!;
      // Hamlet centers on a grid inside the district.
      const hCenter = gridSlot(i, depNames.length, d.center, hamletSpacing);
      const hRadius = Math.max(3.5, Math.sqrt(depPods.length) * 3.2);
      hamlets.push({ deploymentName: dep, namespace: d.namespace, center: hCenter, radius: hRadius });

      // Pod-houses on a tight grid inside each hamlet; sorted for stable assignment.
      const sortedPods = [...depPods].sort((a, b) => a.uid.localeCompare(b.uid));
      sortedPods.forEach((pod, idx) => {
        buildings.push({
          resourceId: pod.uid,
          resourceType: 'pod',
          position: gridSlot(idx, sortedPods.length, hCenter, 5.5),
          rotationY: (hashString(pod.uid + ':rot') % 360) * (Math.PI / 180),
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
      position: stableDiskPosition(id + ':ext', d.center, d.radius * 1.08),
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
        position: v3(d.center.x + Math.cos(a) * (d.radius + 4), 0, d.center.z + Math.sin(a) * (d.radius + 4)),
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
    const pos = stableDiskPosition(sec.uid + ':ext', d.center, d.radius * 1.08);
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
  const props = buildProps(districts, hamlets, terrain);

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
): PropsLayout {
  const trees: Vec3[] = [];
  const lamps: Vec3[] = [];
  const decor: DecorItem[] = [];
  const groundCover: Vec3[] = [];

  const addDecor = (model: string, pos: Vec3, rotationY: number) =>
    decor.push({ model, position: pos, rotationY, scale: DECOR_SCALE[model] ?? 2 });

  for (const d of districts) {
    // Lamp posts at alternating district wall vertices.
    d.wallVertices.forEach((v, i) => {
      if (i % 2 === 0) lamps.push(v3(v.x, 0, v.z));
    });
    // A ring of trees just outside the district wall, capped to island edge.
    const islandEdgeR = d.radius * 1.28; // island boundary (1.3× but leave 2% gap)
    const treeRing = Math.floor(d.radius / 2.2);
    for (let i = 0; i < treeRing; i++) {
      const a = (i / treeRing) * Math.PI * 2 + (hashString(d.namespace) % 100) / 100;
      const rawR = d.radius + 3.5 + ((hashString(d.namespace + i) % 100) / 100) * 2;
      const r = Math.min(rawR, islandEdgeR - 0.5); // keep trees on land
      trees.push(v3(d.center.x + Math.cos(a) * r, 0, d.center.z + Math.sin(a) * r));
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
    const islandR = d.radius * 1.28; // matches the 1.3 expansion in buildTerrain
    const shoreInner = d.radius + 1;
    const shoreOuter = islandR - 0.5;
    if (shoreOuter <= shoreInner) continue;
    const rng = mulberry32(hashString('shore:' + d.namespace));
    const count = Math.max(4, Math.floor(d.radius / 2.5));
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = shoreInner + rng() * (shoreOuter - shoreInner);
      const x = d.center.x + Math.cos(a) * r;
      const z = d.center.z + Math.sin(a) * r;
      if (rng() > 0.88) addDecor('Rock_1', v3(x, 0, z), rng() * Math.PI * 2);
      else trees.push(v3(x, 0, z));
    }
  }

  // Dense ground cover (grass, bushes, plants) scattered across each island.
  for (const d of districts) {
    const islandR = d.radius * 1.28;
    const rng = mulberry32(hashString('gc:' + d.namespace));
    const count = Math.floor(d.radius * 4);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * islandR * 0.95;
      groundCover.push(v3(d.center.x + Math.cos(a) * r, 0, d.center.z + Math.sin(a) * r));
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
