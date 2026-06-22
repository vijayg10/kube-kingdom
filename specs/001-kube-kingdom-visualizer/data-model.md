# Data Model: Kube Kingdom Visualizer

**Phase 1 output for**: `specs/001-kube-city-visualizer/plan.md`
**Date**: 2026-06-19

All types are shared between `client/src/types/cluster.ts` and
`server/src/types/cluster.ts` (mirrored files).

---

## Cluster State Entities

### PodHealth

```typescript
type PodHealth =
  | 'Running'          // Green — healthy, active
  | 'Pending'          // Gray — under construction
  | 'Restarting'       // Amber — flashing lantern
  | 'CrashLoopBackOff' // Red — fire + smoke
  | 'Evicted'          // Dark — ruined structure
  | 'Succeeded'        // Faded green — job completed
  | 'Unknown';         // Gray — no data
```

### NodeHealth

```typescript
type NodeHealth =
  | 'Ready'            // Fully lit, banners flying
  | 'ResourcePressure' // Orange glow, congested roads
  | 'Unreachable'      // Dark building, red beacon
  | 'Unknown';
```

### Container

```typescript
interface Container {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
}
```

### Pod

```typescript
interface Pod {
  uid: string;              // Kubernetes UID — stable city house ID
  name: string;
  namespace: string;
  nodeName: string;
  deploymentName?: string;  // Which deployment/hamlet this house belongs to
  health: PodHealth;
  cpuMillicores: number;    // Current CPU usage
  memoryMiB: number;        // Current memory usage
  restartCount: number;
  createdAt: string;        // ISO 8601
  labels: Record<string, string>;
  containers: Container[];
}
```

### Node

```typescript
interface KubeNode {
  name: string;             // Stable node name — city landmark ID
  health: NodeHealth;
  cpu: {
    capacityMillicores: number;
    usedMillicores: number;
  };
  memory: {
    capacityMiB: number;
    usedMiB: number;
  };
  podCount: number;
  labels: Record<string, string>;
  cordoned: boolean;
}
```

### Namespace

```typescript
interface Namespace {
  name: string;
  labels: Record<string, string>;
  theme: NamespaceTheme;    // Derived from name; see NamespaceTheme below
}

type NamespaceTheme =
  | 'citadel'       // kube-system — central castle
  | 'production'    // Grand stone buildings
  | 'staging'       // Modest timber buildings
  | 'development'   // Construction zones
  | 'default';      // Generic district
```

### Service

```typescript
interface KubeService {
  uid: string;
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector: Record<string, string>;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
}
```

### Deployment

```typescript
interface Deployment {
  uid: string;
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  labels: Record<string, string>;
}
```

### Tier-2 Extended Resource Entities (US6, FR-023)

These resource types render as their city counterparts in Tier 2. All share a common
base (`uid`, `name`, `namespace`, `labels`); type-specific fields are noted.

```typescript
interface ResourceBase {
  uid: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
}

interface Ingress extends ResourceBase {        // → City Gate
  hosts: string[];
  serviceUids: string[];                         // Backend services this gate routes to
}

interface LoadBalancer extends ResourceBase {    // → Crossroads / Interchange
  externalIP?: string;
  serviceUid: string;
}

interface StatefulSet extends ResourceBase {     // → Row of numbered townhouses
  replicas: number;
  readyReplicas: number;
  ordinals: number[];                            // Ordered identities (0..N-1)
}

interface DaemonSet extends ResourceBase {       // → Watchtower (one per node)
  desiredNumberScheduled: number;
  numberReady: number;
  nodeNames: string[];
}

interface JobResource extends ResourceBase {     // → Traveling merchant
  kind: 'Job' | 'CronJob';
  schedule?: string;                             // Cron expression (CronJob only)
  state: 'Active' | 'Completed' | 'Failed';
  completions: number;
}

interface PersistentVolume extends ResourceBase {// → Warehouse / Storage barn
  capacityGiB: number;
  phase: 'Bound' | 'Available' | 'Released' | 'Failed';
  boundPodUids: string[];
}

interface HPA extends ResourceBase {             // → Construction foreman
  targetDeployment: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
}

interface ConfigMap extends ResourceBase {       // → Wells / signposts
  keys: string[];
}

interface Secret extends ResourceBase {          // → Fortified vault
  keys: string[];                                // Names only — values never sent
  type: string;
}
```

### ClusterSummary

```typescript
interface ClusterSummary {
  totalPods: number;
  totalNodes: number;
  cpuPercent: number;       // Cluster-wide average CPU utilization 0–100
  memoryPercent: number;    // Cluster-wide average memory utilization 0–100
  healthyPods: number;
  unhealthyPods: number;
}
```

### ClusterState (full snapshot)

```typescript
interface ClusterState {
  namespaces: Namespace[];
  nodes: KubeNode[];
  pods: Pod[];
  services: KubeService[];
  deployments: Deployment[];
  // Tier-2 extended resources (US6) — empty until those watchers/mock emitters land:
  ingresses: Ingress[];
  loadBalancers: LoadBalancer[];
  statefulSets: StatefulSet[];
  daemonSets: DaemonSet[];
  jobs: JobResource[];
  persistentVolumes: PersistentVolume[];
  hpas: HPA[];
  configMaps: ConfigMap[];
  secrets: Secret[];
  summary: ClusterSummary;
  snapshotAt: string;       // ISO 8601 — when snapshot was taken
}
```

---

## City Layout Entities

These are computed by `client/src/layout/cityLayout.ts` from `ClusterState`.
They are never sent over the network — they live only in the frontend.

### Vec3

```typescript
interface Vec3 {
  x: number;
  y: number;
  z: number;
}
```

### DistrictLayout

```typescript
interface DistrictLayout {
  namespace: string;
  center: Vec3;
  wallVertices: Vec3[];     // Irregular polygon defining the district boundary
  color: string;            // Hex color for minimap + district glow
  theme: NamespaceTheme;
}
```

### BuildingLayout

```typescript
interface BuildingLayout {
  resourceId: string;       // Pod UID or node name
  resourceType: 'pod' | 'node';
  position: Vec3;
  rotationY: number;        // Radians — stable, derived from resourceId hash
  namespace: string;
  lodDistances: [number, number]; // [far→mid threshold, mid→close threshold]
}
```

### RoadLayout

```typescript
interface RoadLayout {
  serviceUid: string;
  podUids: string[];        // Tier 1: backing pod-houses this service road connects (FR-026)
  pathPoints: Vec3[];       // Cubic bezier control points
  width: number;
  // Service-to-service dependency roads (fromService→toService) are added in Tier 2
  // from observed traffic edges (FR-017), not modeled here for Tier 1.
}
```

### TerrainLayout

Defines the ground the city sits on (FR-022). Generated once with the layout; stable
across pod churn.

```typescript
type TerrainSurface = 'grass' | 'dirt' | 'stone' | 'water';

interface TerrainTile {
  position: Vec3;
  surface: TerrainSurface;
  elevation: number;        // Height offset for elevation changes
}

interface TerrainLayout {
  tiles: TerrainTile[];
  waterFeatures: Vec3[][];  // Polygons marking rivers/ponds
  bounds: { min: Vec3; max: Vec3 };
}
```

### CityLayout

```typescript
interface CityLayout {
  terrain: TerrainLayout;
  districts: DistrictLayout[];
  buildings: BuildingLayout[];
  roads: RoadLayout[];
  generatedAt: string;      // ISO 8601 — layout is cached; only regenerated on
                            // namespace add/remove, not on pod churn
}
```

---

## Traffic & Event Entities (Tier 2)

```typescript
interface TrafficUnit {
  id: string;
  fromServiceUid: string;
  toServiceUid: string;
  type: 'cart' | 'horse' | 'messenger';
  status: 'normal' | 'elevated' | 'high' | 'critical' | 'failed'; // 4 latency tiers + failure (FR-017)
  progressT: number;        // 0.0–1.0 along road path
  startedAt: number;        // performance.now() timestamp
}

interface TrafficEvent {
  serviceUid: string;
  requestsPerSecond: number;
  errorRate: number;        // 0.0–1.0
  latencyMs: number;
}
```

---

## State Transitions

### Pod Health State Machine

```
[Pending] ──────────────────► [Running]
    │                             │
    │                      crash/OOMKill
    │                             │
    │                             ▼
    │                    [CrashLoopBackOff] ◄──── restart fails
    │                             │
    │                        backoff ends
    │                             │
    └────────────────────────► [Restarting]
                                  │
                              restart ok
                                  │
                                  ▼
                               [Running]

[Running] ──── eviction ────► [Evicted]
[Running] ──── job done ────► [Succeeded]
Any ─────── watch lost ─────► [Unknown]
```

### Layout Regeneration Policy

- **Pod added/removed**: Update `buildings[]` for that namespace only. No district
  boundary changes.
- **Namespace added**: Add new `DistrictLayout` to outer ring. Existing districts
  do not move.
- **Namespace removed**: Remove district and all its buildings. Remaining districts
  do not reflow.
- **Node added/removed**: Update `buildings[]` for node type. District boundaries
  unchanged.
