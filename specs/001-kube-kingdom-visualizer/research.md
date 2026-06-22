# Research: Kube Kingdom Visualizer

**Phase 0 output for**: `specs/001-kube-city-visualizer/plan.md`
**Date**: 2026-06-19

---

## 1. City Layout Algorithm

**Decision**: Organic procedural layout using seeded zone partitioning (Voronoi-inspired)
for namespace districts + local force-directed placement for buildings within districts.

**Rationale**:
- Voronoi partitioning gives irregular-shaped district polygons that feel like real
  medieval city quarters — not grids, not circles.
- Seeding the layout with the namespace name ensures the same cluster always produces
  the same city shape. Adding a new pod does not trigger a global re-layout.
- `kube-system` is pinned to the center cell before partitioning; remaining namespaces
  receive cells by resource count (larger namespaces → larger cells).
- Within each district, buildings are placed using a simple grid-within-bounds approach
  with small random offsets per resource UID — stable because the offset is derived
  from the UID, not computed fresh each render.

**Alternatives considered**:
- Pure random placement: rejected — unstable (rearranges on every update).
- Grid layout: rejected — too uniform, loses the medieval city feel.
- Full physics simulation: rejected — expensive, non-deterministic across sessions.

---

## 2. LOD + Performance Strategy for 500–1,000 Pods

**Decision**: Three-tier LOD using `drei <Lod>` + `THREE.InstancedMesh` for pod houses
+ frustum culling via R3F defaults.

**Rationale**:
- `InstancedMesh` reduces 1,000 pod house draw calls to 1–2 (one per mesh variant).
  Each pod house is one instance; health state drives per-instance color via
  `InstancedMesh.setColorAt()` — no material swap needed.
- `drei <Lod>` swaps meshes by camera distance automatically:
  - Far (>80 units): Districts only — no building meshes drawn at all.
  - Mid (20–80 units): Low-poly instanced meshes (~100 triangles each).
  - Close (<20 units): Full glTF model with textures, props, effects.
- R3F enables frustum culling by default; buildings outside the camera frustum
  are skipped by Three.js automatically.
- Particle effects (smoke, fire) use `drei <Instances>` with a pool of 200 max
  active particles to cap GPU overhead.

**Alternatives considered**:
- Individual mesh per pod: rejected — 1,000 draw calls will drop to <10 fps.
- CSS2D labels at all zoom levels: rejected — DOM overhead; labels only render
  at close zoom via `drei <Html>` with `occlude` prop.

---

## 3. WebSocket Architecture

**Decision**: Single persistent WebSocket connection per client session. Server pushes
typed JSON messages. Client sends action requests (Tier 2 only).

**Rationale**:
- One WS connection per tab is sufficient — this is a single-cluster, single-user
  local tool. No need for rooms or namespacing.
- `ws` library on the server handles reconnection detection via `on('close')`;
  client implements exponential backoff reconnect (max 5 retries, then error state).
- Server sends a full `CLUSTER_SNAPSHOT` on connect, then delta `*_UPDATED` /
  `*_DELETED` events thereafter. This avoids re-sending unchanged resources.
- Message envelope: `{ type: string; payload: unknown; timestamp: number }`.

**Alternatives considered**:
- HTTP polling: rejected — too slow for live city animation (3s update target requires
  near-realtime push).
- Server-Sent Events: rejected — one-directional; cannot send action requests in Tier 2.
- GraphQL subscriptions: rejected — overkill for a local tool with no schema evolution.

---

## 4. Zustand Store Architecture for R3F + WebSocket

**Decision**: Two Zustand stores — `clusterStore` (resource state) and `uiStore`
(camera, selection, panel). R3F components subscribe to specific slices to avoid
global re-renders.

**Rationale**:
- `clusterStore` holds a `Map<string, Pod>` keyed by pod UID. A WebSocket
  `POD_UPDATED` event calls `store.getState().updatePod(pod)` — only components
  subscribed to that specific pod UID re-render.
- `InstancedMesh` health updates bypass React entirely: `useFrame` reads the
  `clusterStore` pod health map directly and calls `mesh.setColorAt()` each frame.
  This is the key performance pattern for R3F + Zustand.
- `uiStore` holds selected resource ID, detail panel open state, camera target.
  These update on user interaction, not on WebSocket events.

**Alternatives considered**:
- Single large store: rejected — any pod update would re-render all components.
- React Context: rejected — context re-renders all consumers on every update.
- Redux Toolkit: rejected — 40KB overhead, reducer boilerplate, no advantage over
  Zustand for this use case. `useSelector` inside `useFrame` triggers React re-renders.

---

## 5. 3D Asset Pipeline

**Decision**: Load glTF/GLB models via `useGLTF` (drei). Use DRACO compression for
models >500KB. Cache models at the `<Suspense>` boundary.

**Rationale**:
- `useGLTF` preloads and caches models; multiple instances of the same building type
  share one geometry + material via `InstancedMesh`.
- DRACO compression reduces typical Kenney pack models from ~2MB to ~200KB,
  keeping initial load under 5 seconds on localhost.
- `drei <Suspense>` wraps the city scene; a simple loading spinner shows while
  assets load on first run.

**Asset sourcing plan**:
- **Kenney Medieval Town** pack: nodes (castle, tower), pod houses (cottages, huts)
- **Quaternius Cartoon Town** pack: roads, market stalls (services), walls
- **poly.pizza CC0**: specialty buildings (vault/secret, watchtower/daemonset)
- Asset selection MUST be confirmed at the Check-In gate before integration.

**Alternatives considered**:
- Procedural geometry: rejected — violates constitution Principle I (must not model
  from scratch when free assets exist).
- OBJ/FBX formats: rejected — glTF/GLB is the constitution-mandated format.

---

## 6. Kubernetes Watch API Integration

**Decision**: Use `@kubernetes/client-node` Watch class with automatic reconnection.
One Watch stream per resource type (pods, nodes, namespaces, services, deployments).

**Rationale**:
- `k8s.Watch` handles kubeconfig parsing, TLS, and the `resourceVersion` bookmark
  pattern for reconnection without re-listing all resources.
- Each watch stream runs independently; a pod watch failure does not break node watching.
- `MOCK_MODE=true` bypasses all k8s code and runs `mockCluster.ts` instead, which
  simulates pod status transitions (Pending → Running → CrashLoopBackOff) on a
  randomized timer to keep the demo city alive.

**Alternatives considered**:
- `kubectl` subprocess with `--watch` flag: rejected — brittle stdout parsing,
  no typed responses, poor reconnection handling.
- Direct Kubernetes HTTP API with `fetch`: rejected — reinvents what
  `@kubernetes/client-node` already handles (auth, kubeconfig, watch bookmarks).
