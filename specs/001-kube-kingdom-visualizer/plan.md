# Implementation Plan: Kube Kingdom Visualizer

**Branch**: `001-kube-city-visualizer` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-kube-city-visualizer/spec.md`

## Summary

Build a fully interactive Kubernetes cluster visualizer rendered as a top-down isometric
3D medieval city in the browser. Namespaces are walled districts, nodes are landmark
buildings, pods are houses, and services are roads. Health state and incidents are
communicated through color, visual effects, and audio. The Node.js backend streams live
cluster events over WebSockets using `@kubernetes/client-node`; a mock mode generates a
full synthetic city without a real cluster. Frontend is React 18 + React Three Fiber
with Zustand for state, targeting 60 fps for clusters of 500–1,000 pods via instancing
and a three-tier LOD system.

## Technical Context

**Language/Version**: TypeScript 5.x throughout — Node.js 20 LTS (backend),
React 18 + Vite 5 (frontend)

**Primary Dependencies**:
- Frontend: `react@18`, `vite@5`, `@react-three/fiber`, `@react-three/drei`,
  `three`, `zustand`, `@react-three/postprocessing`
- Backend: `express@4`, `ws`, `@kubernetes/client-node`, `tsx` (TS runner),
  `dotenv`

**Storage**: None — cluster state is ephemeral, held in server memory and pushed to
clients over WebSockets. No database required.

**Testing**: None — manual visual validation only.

**Target Platform**: Modern desktop browser (Chrome, Firefox, Safari, Edge).
Runs locally via `npm run dev`. No mobile, no cloud deployment.

**Project Type**: Web application — npm workspaces monorepo with `client/` and
`server/` packages.

**Performance Goals**: 60 fps at mid zoom for 500–1,000 pods on a modern MacBook Pro;
demo city loads in under 5 seconds; live cluster state updates reflected in under 3s.

**Constraints**: Local-only (no deployment target); `READ_ONLY=true` default; stable
city layout (pod additions never rearrange existing structures); fixed golden-hour
lighting only; no formal test suite.

**Scale/Scope**: 500–1,000 pods, ~10 namespaces, ~10 nodes, ~50 services; single
cluster per session.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Isometric-First Visual Design | All resource types have city metaphors; glTF assets from free packs only; golden-hour lighting | ✅ Pass — 20 resource types mapped in PROMPT.md; asset sourcing from Kenney/Quaternius/poly.pizza |
| II. Cluster-Faithful Data Mapping | WebSocket Watch API; stable layout; mock mode ≥30 pods, ≥4 namespaces | ✅ Pass — `@kubernetes/client-node` Watch streams; layout algorithm preserves existing positions on update |
| III. Performance-Conscious LOD | Three-tier LOD; 60 fps; no pop-in | ✅ Pass — `InstancedMesh` for pods + drei `<Lod>` + frustum culling; targeting 500–1,000 pods |
| IV. Real-Time Health Visibility | Color + effects per health state; HUD bar; updates <3s | ✅ Pass — WebSocket push; health states drive material/particle system per pod |
| V. Progressive Feature Tiers | Tier 1 gated from Tier 2; no early Tier 2/3 work | ✅ Pass — tasks.md will include a hard Tier 1 completion checkpoint before any Tier 2 task |

**Check-In Gates (MUST NOT be skipped during implementation)**:
1. Before building the world scene — present 3 visual style directions (A/B/C)
2. Before integrating 3D model packs — present 3 asset options with links + previews
3. Any major scope cut or addition

All gates pass. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-kube-city-visualizer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── websocket-protocol.md
│   └── rest-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code

```text
kube-city/
├── package.json                      # Root npm workspace config
├── client/                           # React + R3F frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── store/
│       │   ├── clusterStore.ts       # Zustand: live cluster resource state
│       │   └── uiStore.ts            # Zustand: camera, selection, detail panel
│       ├── components/
│       │   ├── city/                 # R3F scene components
│       │   │   ├── CityScene.tsx     # Root Canvas, lighting, camera
│       │   │   ├── Terrain.tsx       # Ground: grass, dirt/stone paths, water, elevation (FR-022)
│       │   │   ├── District.tsx      # Namespace walled district
│       │   │   ├── NodeBuilding.tsx  # Node landmark building
│       │   │   ├── PodHouse.tsx      # InstancedMesh pod houses
│       │   │   ├── Road.tsx          # Service road connections
│       │   │   ├── Traffic.tsx       # Carts/horses/messengers on roads (US4, Tier 2)
│       │   │   ├── extended/         # US6 extended resource buildings (Tier 2)
│       │   │   │   ├── CityGate.tsx       # Ingress
│       │   │   │   ├── Interchange.tsx    # LoadBalancer
│       │   │   │   ├── StatefulHouses.tsx # StatefulSet
│       │   │   │   ├── Watchtower.tsx     # DaemonSet
│       │   │   │   ├── Merchant.tsx       # Job / CronJob
│       │   │   │   ├── Warehouse.tsx      # PersistentVolume / PVC
│       │   │   │   ├── Foreman.tsx        # HPA
│       │   │   │   ├── ConfigInfra.tsx    # ConfigMap (wells/signposts)
│       │   │   │   └── Vault.tsx          # Secret
│       │   │   └── effects/
│       │   │       ├── HealthGlow.tsx
│       │   │       ├── SmokeParticles.tsx
│       │   │       └── FireEffect.tsx
│       │   ├── hud/
│       │   │   ├── ResourceBar.tsx   # Top HUD: pods/nodes/CPU/memory
│       │   │   ├── Minimap.tsx       # Corner minimap with click-to-navigate
│       │   │   ├── DetailPanel.tsx   # Parchment scroll resource inspector
│       │   │   ├── ContextMenu.tsx   # Right-click actions (US5, Tier 2)
│       │   │   ├── AudioControls.tsx # Ambient audio + mute (US4, Tier 2)
│       │   │   └── LogsPanel.tsx     # View Logs / Describe (US5, Tier 2)
│       │   └── landing/
│       │       └── LandingScreen.tsx # Demo / Connect Cluster entry
│       ├── hooks/
│       │   ├── useWebSocket.ts       # WS connect, reconnect, message dispatch
│       │   └── useLOD.ts             # Camera distance → LOD level
│       ├── layout/
│       │   └── cityLayout.ts         # Organic district + building placement
│       └── types/
│           └── cluster.ts            # Shared TS types (mirrored from server)
└── server/
    ├── package.json
    └── src/
        ├── index.ts                  # Express + WS server entry
        ├── ws/
        │   └── broadcaster.ts        # WebSocket server, client registry, event dispatch
        ├── k8s/
        │   ├── watcher.ts            # @kubernetes/client-node Watch streams
        │   └── mockCluster.ts        # Synthetic cluster generator + live simulation
        └── types/
            └── cluster.ts            # Shared TS types (mirrored from client)
```

**Structure Decision**: Web application monorepo. `client/` holds all frontend code;
`server/` holds all backend code. Shared TypeScript types are mirrored in both
`client/src/types/` and `server/src/types/` — no third workspace package needed
at this scale. Extract to `shared/` if type divergence becomes a maintenance problem.

### Tier-2 design notes

Tier-2 scope (US4 traffic/incident, US5 actions, US6 extended resource renderings) is
now designed: entities are in `data-model.md`, components are in the tree above, and
these contract additions are required when Tier-2 tasks execute:

- **`ACTION_VIEW_LOGS` / `ACTION_DESCRIBE`** messages added to
  `contracts/websocket-protocol.md` (FR-021, task T058).
- **Extended-resource WS messages** (`INGRESS_UPDATED`, `STATEFULSET_UPDATED`, etc.)
  added to the protocol when US6 watchers/mock emitters land (task T060).

### Deferred to Tier 3 (out of scope here)

Not designed in this plan — each gets its own spec/plan when prioritized:
NetworkPolicy (walls/gates), CRD (exotic buildings), Database (treasury), Queue
(caravan post), distributed traces, multi-cluster world map, and full observability
integrations.

## Complexity Tracking

> No constitution violations found. No complexity justification required.
