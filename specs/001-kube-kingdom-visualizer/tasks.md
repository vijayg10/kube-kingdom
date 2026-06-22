---
description: "Task list for Kube Kingdom Visualizer implementation"
---

# Tasks: Kube Kingdom Visualizer

**Input**: Design documents from `/specs/001-kube-city-visualizer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: NOT included — the spec specifies manual visual validation only, no formal
test suite. No test tasks are generated.

**Organization**: Tasks are grouped by user story. P1 stories (US1–US3) constitute
Tier 1 (MVP). P2 stories (US4–US6) are Tier 2 and are gated behind a hard Tier-1
completion checkpoint per the project constitution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US5 (user story phases only)
- File paths assume the monorepo layout in plan.md (`client/`, `server/`)

## ⚠️ Constitution Check-In Gates (MUST NOT be skipped)

Two tasks below (T020, T021) are mandatory human approval gates from the constitution's
Check-In Protocol. Implementation MUST pause at each and await explicit user approval.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo and toolchain initialization

- [X] T001 Create npm workspace root `package.json` declaring `client` and `server` workspaces, with a root `dev` script
- [X] T002 [P] Scaffold client package (Vite + React 18 + TypeScript) in `client/` with `vite.config.ts`, `index.html`, `src/main.tsx`
- [X] T003 [P] Scaffold server package (Node + TypeScript + `tsx` runner) in `server/` with `src/index.ts` entrypoint
- [X] T004 [P] Install client dependencies in `client/package.json`: `@react-three/fiber`, `@react-three/drei`, `three`, `zustand`, `@react-three/postprocessing`
- [X] T005 [P] Install server dependencies in `server/package.json`: `express`, `ws`, `@kubernetes/client-node`, `dotenv`
- [X] T006 [P] Configure `tsconfig.json`, linting, and formatting for both `client/` and `server/`
- [X] T007 Wire root `npm run dev` to run client (Vite) and server concurrently
- [X] T008 Set up env var loading and document `MOCK_MODE`, `READ_ONLY`, `KUBECONFIG`, `PORT`, `VITE_WS_URL` in `server/src/index.ts` and a root `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, data transport, and base scene — required before ANY user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [X] T009 [P] Define shared cluster types (Pod, KubeNode, Namespace, KubeService, Deployment, Container, ClusterSummary, ClusterState, PodHealth, NodeHealth) in `server/src/types/cluster.ts` per data-model.md
- [X] T010 [P] Mirror identical shared cluster types in `client/src/types/cluster.ts`
- [X] T011 Define WebSocket message envelope and message-type union (both type files) per `contracts/websocket-protocol.md`
- [X] T012 Implement Express server with REST `GET /health` and `GET /env` in `server/src/index.ts` per `contracts/rest-api.md`
- [X] T013 Implement WebSocket broadcaster (client registry, `CLUSTER_SNAPSHOT` on connect, delta `*_UPDATED`/`*_DELETED` dispatch, `SUMMARY_UPDATED` every 5s) in `server/src/ws/broadcaster.ts`
- [X] T014 Implement mock cluster generator + live simulation loop (≥3 nodes, ≥4 namespaces, ~30 pods, randomized status transitions) in `server/src/k8s/mockCluster.ts`
- [X] T015 [P] Implement Zustand `clusterStore` (Map-keyed resources, upsert/delete actions) in `client/src/store/clusterStore.ts`
- [X] T016 [P] Implement Zustand `uiStore` (selection, detail-panel state, camera target) in `client/src/store/uiStore.ts`
- [X] T017 Implement `useWebSocket` hook (connect, exponential-backoff reconnect, dispatch messages into stores) in `client/src/hooks/useWebSocket.ts`
- [X] T018 Implement app shell and view routing (landing ↔ city) in `client/src/App.tsx`
- [X] T019 Implement `CityScene` root: R3F `<Canvas>`, fixed golden-hour directional + ambient lighting, soft shadows, postprocessing (AO, fog) in `client/src/components/city/CityScene.tsx`
- [X] T020 🚦 **CHECK-IN GATE 1** — Present 3 visual style directions (A/B/C) each with a one-line tradeoff; pause and await user selection before any city rendering work

**Checkpoint**: Transport, state, and base scene ready — user stories can begin

---

## Phase 3: User Story 1 — Cluster Discovery via City View (Priority: P1) 🎯 MVP

**Goal**: Render the cluster as a living medieval city (districts, nodes, pods, roads,
terrain) with RTS camera, minimap, LOD, and landing/connect flows.

**Independent Test**: Load demo mode — city renders ≥3 districts, ≥3 landmark nodes,
≥20 houses; camera pan/zoom/rotate works; minimap click jumps to a district.

- [X] T021 🚦 **CHECK-IN GATE 2** — Present 3 glTF/GLB asset pack options (Kenney/Quaternius/poly.pizza) with links and previews; pause and await user approval before integrating models
- [X] T022 [US1] Implement `LandingScreen` ("Kube Kingdom" title, Explore Demo, Connect Cluster buttons) in `client/src/components/landing/LandingScreen.tsx`
- [X] T023 [US1] Implement Connect Cluster form (paste kubeconfig) and send `CONNECT_MOCK` / `CONNECT_CLUSTER` messages; handle `ERROR` responses. Server MUST hold the kubeconfig in memory only — never write it to disk; discard on disconnect/restart (FR-024)
- [X] T024 [US1] Implement Kubernetes watcher (pods, nodes, namespaces, services, deployments watch streams with reconnection) in `server/src/k8s/watcher.ts`; source live CPU/memory from the Metrics API and fall back to "N/A" when metrics-server is absent (FR-025)
- [X] T025 [US1] Implement city layout engine (Voronoi districts, kube-system centered, UID-stable building placement, service→pod roads per FR-026, terrain tiles) in `client/src/layout/cityLayout.ts` per research.md
- [X] T026 [P] [US1] Implement `Terrain.tsx` (grass, dirt/stone paths, water features, elevation) in `client/src/components/city/Terrain.tsx` (FR-022)
- [X] T027 [P] [US1] Implement `District.tsx` (walled namespace district with theme) in `client/src/components/city/District.tsx`
- [X] T028 [P] [US1] Implement `NodeBuilding.tsx` (glTF landmark building) in `client/src/components/city/NodeBuilding.tsx`
- [X] T029 [P] [US1] Implement `PodHouse.tsx` using `InstancedMesh` for pod houses in `client/src/components/city/PodHouse.tsx`
- [X] T030 [P] [US1] Implement `Road.tsx` (bezier roads connecting each Service to the pod-houses it selects, per FR-026) in `client/src/components/city/Road.tsx`
- [X] T031 [US1] Implement RTS camera controls (WASD/edge-scroll pan, scroll-wheel zoom, middle-mouse rotate) in `CityScene`
- [X] T032 [US1] Implement LOD system (drei `<Lod>` + `useLOD`: far=districts only, mid=low-poly, close=full detail) in `client/src/hooks/useLOD.ts`
- [X] T033 [US1] Implement `Minimap.tsx` (color-coded districts, click-to-navigate) in `client/src/components/hud/Minimap.tsx`

**Checkpoint**: A navigable demo city renders end-to-end — MVP slice 1 complete

---

## Phase 4: User Story 2 — Resource Inspection (Priority: P1)

**Goal**: Click any building/unit to inspect it in a parchment detail panel with expand.

**Independent Test**: Click a house → parchment summary (name, status, CPU/mem, age,
restarts); Expand → full detail; box-select → aggregate summary.

- [X] T034 [US2] Implement raycaster click selection (building/unit → `uiStore.selected`) in `CityScene`
- [X] T035 [US2] Implement `DetailPanel.tsx` parchment summary view (name, namespace, status, CPU/memory, age, restart count, labels) in `client/src/components/hud/DetailPanel.tsx`
- [X] T036 [US2] Implement expand view in `DetailPanel.tsx` (events, conditions, volumes, env vars, annotations) using `drei <Html>`
- [X] T037 [US2] Implement drag box-select with aggregate group summary for multiple resources
- [X] T038 [US2] Wire Escape key and click-away to close the detail panel

**Checkpoint**: Inspection works on the demo city — MVP slice 2 complete

---

## Phase 5: User Story 3 — Real-Time Health Visibility (Priority: P1)

**Goal**: Pod and node health readable at a glance via color, effects, and the HUD bar.

**Independent Test**: In demo mode at least one CrashLoopBackOff pod visually differs
(red/fire/smoke) without interaction; HUD shows live pod/node/CPU/mem totals.

- [X] T039 [US3] Implement pod health color coding via `InstancedMesh.setColorAt` driven from `clusterStore` inside `useFrame` (green/amber/red/gray) in `PodHouse.tsx` (FR-011)
- [X] T040 [P] [US3] Implement `HealthGlow.tsx` in `client/src/components/city/effects/HealthGlow.tsx`
- [X] T041 [P] [US3] Implement `SmokeParticles.tsx` (pooled instanced particles) in `client/src/components/city/effects/SmokeParticles.tsx`
- [X] T042 [P] [US3] Implement `FireEffect.tsx` (CrashLoopBackOff) in `client/src/components/city/effects/FireEffect.tsx`
- [X] T043 [US3] Implement Pending scaffolding and Evicted ruin states in `PodHouse.tsx`
- [X] T044 [US3] Implement node health visual states (Ready/banners, ResourcePressure/orange, Unreachable/dark+beacon) in `NodeBuilding.tsx` (FR-020)
- [X] T045 [US3] Implement `ResourceBar.tsx` HUD (total pods/nodes/CPU%/memory%, consumes `SUMMARY_UPDATED`) in `client/src/components/hud/ResourceBar.tsx` (FR-008)
- [X] T046 [US3] Verify mock simulation health transitions reflect in the city within 3s (SC-004)

**Checkpoint**: Health visibility complete — **Tier 1 (MVP) feature-complete**

---

## 🛑 TIER 1 GATE (Constitution Principle V)

- [X] T047 Validate ALL P1 stories (US1–US3) against `quickstart.md` checklist and SC-001–SC-007. **Tier 2 work (US4–US5) MUST NOT begin until this passes.**

---

## Phase 6: User Story 4 — Traffic & Incident Visualization (Priority: P2)

**Goal**: Animated road traffic with latency states; incident mode with cascading glow
and audio.

**Independent Test**: Carts move along ≥1 road; a simulated failure makes the origin and
≥1 downstream building glow red along a visible propagation path.

- [X] T048 [US4] Implement `TrafficUnit` rendering (carts/horses/messengers animated along road bezier paths) in a new `client/src/components/city/Traffic.tsx`
- [X] T049 [US4] Implement 4 latency visual states (Normal/Elevated/High/Critical) and red crashing/burning failed carts (FR-017); extend `TrafficUnit.status` in types
- [X] T050 [US4] Implement `TRAFFIC_EVENT` generation in `mockCluster.ts` and client-side handling in `useWebSocket`/store
- [X] T051 [US4] Implement incident mode (affected building pulse-red, failure propagation glow along dependency roads, highlighted chains); propagation follows the Tier-2 traffic edges from T048–T050 (FR-018)
- [X] T052 [US4] Implement audio system (ambient music/city sounds, event cues, incident alarms) with HUD mute toggle in `client/src/components/hud/` (FR-019)

**Checkpoint**: Traffic and incident visualization complete

---

## Phase 7: User Story 5 — Cluster Management Actions (Priority: P2)

**Goal**: Right-click actions (restart/delete/scale/cordon/logs/describe) gated by
`READ_ONLY`, with confirmation dialogs.

**Independent Test**: With write mode on, right-click a house → menu with Restart/Delete;
confirm → action executes and house reacts. Read-only mode shows no menu.

- [X] T053 [US5] Implement `READ_ONLY` gating (server rejects `ACTION_*` with `ACTION_DENIED`; client hides all mutation UI) (FR-016)
- [X] T054 [US5] Implement right-click context menu (Restart, Delete, Scale, Cordon, View Logs, Describe) in a new `client/src/components/hud/ContextMenu.tsx` (FR-014)
- [X] T055 [US5] Implement confirmation dialog for destructive actions (delete/restart) (FR-015)
- [X] T056 [US5] Implement server action handlers `ACTION_RESTART_POD`/`ACTION_DELETE_POD`/`ACTION_SCALE_DEPLOYMENT`/`ACTION_CORDON_NODE` via `@kubernetes/client-node` in `broadcaster.ts`/`watcher.ts`
- [X] T057 [US5] Implement client action dispatch + visual feedback (scaling foreman adds/removes houses, cordon barriers around node)
- [X] T058 [US5] Implement View Logs / Describe panels and `ACTION_VIEW_LOGS`/`ACTION_DESCRIBE` messages (FR-021); add messages to `contracts/websocket-protocol.md`

**Checkpoint**: Management actions complete — Tier 2 feature-complete

---

## Phase 8: User Story 6 — Extended Resource Renderings (Priority: P2)

**Goal**: Render every remaining Tier-2 resource type as its distinct city counterpart
(FR-023), satisfying constitution Principle II (every resource type has a counterpart).

**Independent Test**: In demo mode with these resources present, each renders as its
mapped element (gate, townhouses, watchtower, merchant, warehouse, vault, etc.) and is
visually distinguishable from core building types.

- [X] T059 [US6] Add shared types for the 10 extended resource types (Ingress, LoadBalancer, StatefulSet, DaemonSet, Job/CronJob, PersistentVolume/PVC, HPA, ConfigMap, Secret) in `server/src/types/cluster.ts` and `client/src/types/cluster.ts` per data-model.md
- [X] T060 [US6] Extend `server/src/k8s/mockCluster.ts` and `server/src/k8s/watcher.ts` to emit the extended resource types, and add their `*_UPDATED`/`*_DELETED` messages to `contracts/websocket-protocol.md`
- [X] T061 [US6] Integrate extended resource types into `client/src/layout/cityLayout.ts` placement and LOD (gates at district boundaries, watchtowers on nodes, etc.)
- [X] T062 [P] [US6] Implement `CityGate.tsx` (Ingress) and `Interchange.tsx` (LoadBalancer) in `client/src/components/city/extended/`
- [X] T063 [P] [US6] Implement `StatefulHouses.tsx` (StatefulSet), `Watchtower.tsx` (DaemonSet), and `Merchant.tsx` (Job/CronJob arrive-work-leave) in `client/src/components/city/extended/`
- [X] T064 [P] [US6] Implement `Warehouse.tsx` (PV/PVC), `ConfigInfra.tsx` (ConfigMap wells/signposts), and `Vault.tsx` (Secret) in `client/src/components/city/extended/`
- [X] T065 [US6] Implement `Foreman.tsx` (HPA) with animated house add/remove on scale events in `client/src/components/city/extended/`

**Checkpoint**: Every cluster resource type has a city counterpart — Tier 2 complete

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T066 [P] Set up DRACO compression pipeline for glTF assets (models >500KB) per research.md
- [X] T067 Performance pass: instancing, frustum culling, and LOD tuning to sustain 60 fps at 500–1,000 pods at mid zoom (SC-003); verify the demo city loads in under 5 seconds (SC-002)
- [X] T068 [P] Atmospheric polish: distance fog, chimney smoke, road dust particles (capped particle pool)
- [X] T069 [P] Error-state polish: invalid kubeconfig, cluster unreachable, WebSocket reconnect-failure UI
- [X] T070 Run full `quickstart.md` validation checklist end-to-end (including the SC-002 load-time check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories; ends at Check-In Gate 1 (T020)
- **US1 (Phase 3)**: Depends on Foundational; begins at Check-In Gate 2 (T021)
- **US2 (Phase 4)**: Depends on US1 (needs rendered buildings to click)
- **US3 (Phase 5)**: Depends on US1 (needs pod/node meshes to color); independent of US2
- **TIER 1 GATE (T047)**: Depends on US1–US3 — BLOCKS Tier 2
- **US4 (Phase 6)**: Depends on Tier 1 Gate + US1 roads
- **US5 (Phase 7)**: Depends on Tier 1 Gate; independent of US4
- **US6 (Phase 8)**: Depends on Tier 1 Gate + US1 layout engine; independent of US4/US5
- **Polish (Phase 9)**: Depends on all targeted stories

### User Story Dependencies

- US1 (P1): Foundation only — the base everything builds on
- US2 (P1): Needs US1 meshes (click targets)
- US3 (P1): Needs US1 meshes (health coloring) — parallel to US2
- US4 (P2): Needs US1 roads + Tier 1 Gate
- US5 (P2): Needs US1 + Tier 1 Gate — parallel to US4
- US6 (P2): Needs US1 layout engine + Tier 1 Gate — parallel to US4/US5

### Within Each User Story

- Layout/types before scene components
- Scene components (marked [P]) can build in parallel
- Camera/minimap/LOD after base meshes exist

---

## Parallel Opportunities

```bash
# Phase 1 Setup — scaffolds and installs in parallel:
T002 Scaffold client   |  T003 Scaffold server
T004 Install client deps | T005 Install server deps | T006 Configure TS/lint

# Phase 2 Foundational — shared types + stores in parallel:
T009 Server types  |  T010 Client types
T015 clusterStore  |  T016 uiStore

# Phase 3 US1 — scene components in parallel (after T025 layout engine):
T026 Terrain | T027 District | T028 NodeBuilding | T029 PodHouse | T030 Road

# Phase 5 US3 — effects in parallel:
T040 HealthGlow | T041 SmokeParticles | T042 FireEffect

# Phase 8 US6 — extended building components in parallel (after T059–T061):
T062 Gate/Interchange | T063 Stateful/Watchtower/Merchant | T064 Warehouse/Config/Vault
```

---

## Implementation Strategy

### MVP First (Tier 1 = US1 + US2 + US3)

1. Phase 1 Setup → Phase 2 Foundational (stop at Check-In Gate 1)
2. US1 → navigable demo city (stop at Check-In Gate 2 first)
3. US2 → inspection
4. US3 → health visibility
5. **TIER 1 GATE (T047)** — validate, then stop. This is a shippable MVP.

### Incremental Delivery (Tier 2)

6. US4 → traffic + incident mode
7. US5 → management actions
8. US6 → extended resource renderings (all remaining resource types)
9. Polish pass

### Notes

- Tests are intentionally omitted (manual visual validation per spec)
- Two check-in gates (T020, T021) require user approval — do not skip
- The Tier 1 gate (T047) enforces constitution Principle V
- Commit after each task or logical group
