# Feature Specification: Kube Kingdom — Kubernetes Cluster Visualizer

**Feature Branch**: `001-kube-city-visualizer`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Build a fully interactive Kubernetes cluster visualizer
styled like Age of Empires — a top-down isometric 3D medieval city in the browser."

---

## Clarifications

### Session 2026-06-19

- Q: How should a pasted kubeconfig be handled? → A: Held in server memory for the active session only; never written to disk; discarded on disconnect or server restart.
- Q: Where do real-cluster CPU/memory metrics come from? → A: The Kubernetes Metrics API (metrics-server); if unavailable, show capacity/requests where known and mark live usage "N/A" (graceful degradation, no hard failure).
- Q: What do roads connect in Tier 1? → A: Each Service to the pod-houses it selects (via its selector); service-to-service dependency roads are deferred to Tier 2 traffic data.
- Q: How is the incident failure cascade derived in Tier 2? → A: Propagate along the Tier-2 traffic edges already visualized on the roads (simulated in mock mode; observed traffic for real clusters).

---

## User Scenarios & Testing *(mandatory)*

> **Priority ↔ Tier mapping**: This spec uses story priorities that map directly to the
> delivery tiers defined in `PROMPT.md` and enforced by the constitution:
> **P1 = Tier 1 (MVP, non-negotiable)**, **P2 = Tier 2**. Tier 3 capabilities are
> deferred — see the "Out of Scope" section. Per the constitution, no P2 (Tier 2) work
> begins until all P1 (Tier 1) stories are complete and validated.

### User Story 1 — Cluster Discovery via City View (Priority: P1)

An SRE or platform engineer opens Kube Kingdom in the browser. They are greeted by a
landing screen with two choices: explore a built-in demo city or connect their own
cluster. After choosing, they see their Kubernetes cluster rendered as a living
top-down medieval city. Each namespace is a walled district, each node is a large
landmark building (castle, guild hall), each pod is a house, and services are roads.
The engineer can pan, zoom, and rotate the camera to explore the city, then click the
minimap to jump directly to any district.

**Why this priority**: This is the foundational experience. Every other story depends on
the city rendering correctly. Without it, nothing else is usable.

**Independent Test**: Can be fully tested by loading the demo mode — the city renders a
synthetic cluster with ≥3 districts, ≥3 landmark nodes, and ≥20 houses (pods), camera
controls work, and the minimap accurately reflects the city layout.

**Acceptance Scenarios**:

1. **Given** the user opens the app, **When** they click "Explore Demo",
   **Then** a fully populated city loads within 5 seconds with namespaces as walled
   districts, nodes as large buildings, pods as houses, and services as roads.
2. **Given** the user is viewing the city, **When** they use scroll/pan/rotate controls,
   **Then** the camera responds smoothly with no lag or visual tearing.
3. **Given** a large city view, **When** the user clicks a district on the minimap,
   **Then** the main view jumps to that district instantly.
4. **Given** the user opens the app, **When** they click "Connect Cluster" and paste a
   valid kubeconfig, **Then** their real cluster loads as a city reflecting live state.

---

### User Story 2 — Resource Inspection (Priority: P1)

An engineer clicks on any building or unit in the city. A detail panel slides in —
styled as a parchment scroll — showing the resource's health, key metrics, age,
restart count, and labels. They can expand it to see full resource details: events,
conditions, environment variables, volumes, and annotations. Closing the panel returns
the city to its normal view.

**Why this priority**: Inspection is the core value of a Kubernetes tool. If you cannot
drill into a resource, the visualizer is decorative only.

**Independent Test**: Clicking any house (pod) or landmark (node) opens a parchment-
styled detail panel showing at minimum: name, namespace, status, and key metrics.
The expand button reveals full resource detail. Works in demo mode without a cluster.

**Acceptance Scenarios**:

1. **Given** the city is loaded, **When** the user clicks a house (pod),
   **Then** a parchment-styled summary panel appears showing name, status, CPU/memory
   usage, age, and restart count — within 1 second.
2. **Given** the summary panel is open, **When** the user clicks "Expand",
   **Then** the panel extends to show full resource details (events, conditions,
   volumes, env vars, annotations).
3. **Given** the detail panel is open, **When** the user clicks elsewhere or presses
   Escape, **Then** the panel closes and the city returns to normal.
4. **Given** the user box-selects multiple buildings, **When** selection completes,
   **Then** a grouped summary shows aggregate stats for the selected resources.

---

### User Story 3 — Real-Time Health Visibility (Priority: P1)

An engineer can see cluster health at a glance without clicking anything. Healthy pods
glow green with villagers nearby. Restarting pods show amber flickering lanterns.
CrashLoopBackOff pods emit smoke and fire. Pending pods show construction scaffolding.
Node pressure turns buildings orange; unreachable nodes go dark with a red beacon.
A resource bar at the top of the screen always shows cluster-level totals: pods, nodes,
CPU, and memory.

**Why this priority**: Immediate health visibility is what differentiates this from a
static diagram. SREs must be able to identify problems without clicking.

**Independent Test**: In demo mode, at least one pod in an error state (CrashLoopBackOff
or similar) visually differs from a healthy pod — distinct color, effect, or animation
— without any user interaction. The HUD resource bar shows live totals.

**Acceptance Scenarios**:

1. **Given** the city is loaded, **When** a pod is in a healthy running state,
   **Then** its house glows green with normal activity animations.
2. **Given** the city is loaded, **When** a pod is in CrashLoopBackOff,
   **Then** its house is visually marked (red/fire/smoke effects) distinguishable at a
   glance from healthy houses.
3. **Given** the city is loaded, **When** a pod enters Pending state,
   **Then** scaffolding appears on the house indicating construction.
4. **Given** a real cluster is connected, **When** a pod's status changes,
   **Then** the visual update appears in the city within 3 seconds.
5. **Given** the city is loaded at any zoom level, **When** the user looks at the HUD,
   **Then** the resource bar shows current total pods, nodes, CPU%, and memory%.

---

### User Story 4 — Traffic & Incident Visualization (Priority: P2)

The engineer sees network traffic as moving carts and messengers traveling along the
roads between buildings in real time. When an incident occurs — a pod crash, node
failure, or cascading error — the city visually reacts: affected buildings pulse red,
the failure propagation glows along roads showing the dependency chain, and alarm bells
sound. The engineer can trace the failure path from origin to impact without opening
any terminal.

**Why this priority**: Traffic visualization brings the city alive and makes dependency
relationships tangible. Incident mode is the "aha" moment that justifies the product.
Both require the P1 city rendering to be stable first.

**Independent Test**: In demo mode with simulated traffic, carts move along at least one
road between two buildings. Triggering a simulated failure causes the origin building
and at least one downstream building to glow red, with a visible propagation path.

**Acceptance Scenarios**:

1. **Given** traffic is active, **When** a request flows between two services,
   **Then** a cart or messenger moves visually along the road connecting them.
2. **Given** elevated latency, **When** carts slow down and bunch up on a road,
   **Then** the road shows congestion effects (dust, slowed traffic).
3. **Given** a failed request, **When** it traverses a route,
   **Then** a red cart crashes or catches fire at the point of failure.
4. **Given** a pod enters CrashLoopBackOff, **When** incident mode triggers,
   **Then** the building pulses red, and all dependent service roads highlight the
   failure propagation path.
5. **Given** incident mode is active, **When** the engineer views the city,
   **Then** an audible alarm cue sounds (with mute option in HUD).

---

### User Story 5 — Cluster Management Actions (Priority: P2)

When the cluster is in write-enabled mode, the engineer can right-click any building to
open a context menu and take actions: restart or delete a pod, scale a deployment up or
down, or cordon/uncordon a node. All destructive actions require a confirmation step.
The city visually reflects the result of each action (the house disappears, a foreman
adds/removes houses for scaling). In read-only mode, the context menu is absent and no
mutations are possible.

**Why this priority**: Management actions are a Tier 2 capability that requires the P1
city and inspection flows to be complete first. The read-only default ensures safety.

**Independent Test**: With write mode enabled and a real or simulated cluster, right-
clicking a house (pod) shows a menu with "Restart" and "Delete". Clicking "Restart"
shows a confirmation dialog; confirming triggers the action and the house visually
reacts (amber flicker, then green restoration).

**Acceptance Scenarios**:

1. **Given** write mode is enabled, **When** the user right-clicks a pod house,
   **Then** a context menu appears with: Restart, Delete, View Logs, Describe.
2. **Given** the user selects a destructive action (delete/restart), **When** the menu
   item is clicked, **Then** a confirmation dialog appears before any action executes.
3. **Given** the user scales a deployment up, **When** the action is confirmed,
   **Then** new houses appear in the deployment's district matching the new replica count.
4. **Given** read-only mode is active (default), **When** the user right-clicks any
   building, **Then** no context menu appears and no mutation options are accessible.
5. **Given** write mode is enabled, **When** a node is cordoned,
   **Then** visible barriers appear around the node building and no new pods schedule to it.

---

### User Story 6 — Extended Resource Renderings (Priority: P2)

Beyond the core city (districts, nodes, pods, services), the engineer sees the rest of
their cluster's resource types rendered as distinct city elements: ingresses as city
gates, load balancers as crossroads/interchanges, StatefulSets as rows of numbered
townhouses, DaemonSets as watchtowers, Jobs and CronJobs as traveling/scheduled
merchants, PersistentVolumes as warehouses, ConfigMaps as wells and signposts, Secrets
as fortified vaults, and HPAs as construction foremen that add or remove houses. Every
resource type in the cluster has a recognizable counterpart, so nothing is invisible.

**Why this priority**: Completes the constitution's mandate (Principle II) that every
Kubernetes resource type has a city counterpart. It is Tier 2 because the core city
(Tier 1) must render and be navigable first; these types enrich an already-working city.

**Independent Test**: In demo mode with these resource types present, each renders as its
distinct city element (per the Resource-to-City Mapping table) and is visually
distinguishable from the core building types.

**Acceptance Scenarios**:

1. **Given** the cluster has an Ingress, **When** the city renders, **Then** a city gate
   appears at the district boundary it serves.
2. **Given** the cluster has a StatefulSet, **When** the city renders, **Then** a row of
   numbered townhouses appears reflecting ordered, persistent identity.
3. **Given** the cluster has a DaemonSet, **When** the city renders, **Then** a watchtower
   appears on each node building.
4. **Given** a Job runs and completes, **When** the city renders over time, **Then** a
   traveling merchant arrives, performs work, and leaves.
5. **Given** the cluster has a Secret, **When** the city renders, **Then** a fortified
   vault appears, visually distinct from a regular house.

---

### Edge Cases

- What happens when a namespace has zero pods? (Empty district: walled area with no houses)
- What happens when the cluster has 1,000+ pods? (LOD system kicks in — districts render
  as color-coded zones at far zoom; individual buildings only at close zoom)
- What happens when kubeconfig is invalid or cluster is unreachable? (Error state on
  landing screen with a clear message; demo mode remains available)
- What happens when a node is removed mid-session? (Its building collapses/disappears
  and its pods scatter to other districts or show as evicted ruins)
- What happens if the browser tab loses focus for an extended period? (WebSocket
  reconnects on re-focus; city syncs to current cluster state)
- What happens when metrics-server is not installed on a real cluster? (Live CPU/memory
  show "N/A", building height falls back to a neutral baseline, and the city still
  renders fully from the core API — no hard failure)

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render a Kubernetes cluster as a top-down isometric 3D
  medieval city in the browser, with each resource type mapping to a defined city element.
- **FR-002**: The system MUST provide a demo (mock) mode that generates a realistic
  synthetic cluster (≥3 nodes, ≥4 namespaces, ~30 pods) without requiring a real cluster.
- **FR-003**: The system MUST provide a "Connect Cluster" flow where the user pastes
  kubeconfig content to connect to a real Kubernetes cluster.
- **FR-004**: The system MUST reflect live cluster state changes (pod restarts, scaling,
  status changes) in the city view within 3 seconds of the event occurring.
- **FR-005**: The system MUST implement a Level of Detail (LOD) system: far zoom shows
  districts as color zones; mid zoom shows simplified buildings; close zoom shows full
  detail with effects and labels.
- **FR-006**: The system MUST support RTS-style camera controls: WASD/edge-scroll to
  pan, scroll wheel to zoom, middle-mouse drag to rotate.
- **FR-007**: The system MUST render a minimap showing the full city layout with
  color-coded districts; clicking the minimap MUST jump the camera to that location.
- **FR-008**: The system MUST display a HUD resource bar showing cluster-level totals:
  total pods, nodes, CPU usage, and memory usage.
- **FR-009**: The system MUST allow clicking any city building or unit to open a
  parchment-styled detail panel showing resource summary.
- **FR-010**: The detail panel MUST include an expand option to show full resource
  details (events, conditions, volumes, env vars, annotations).
- **FR-011**: The system MUST color-code buildings by pod health status:
  green (Healthy), amber (Restarting), red (CrashLoopBackOff), gray (Pending),
  collapsed (Evicted).
- **FR-012**: The city layout MUST be stable — adding or removing a single pod MUST NOT
  rearrange unrelated buildings or districts.
- **FR-013**: The `kube-system` namespace MUST always render as the central castle/citadel.
- **FR-014**: When write mode is enabled (`READ_ONLY=false`), right-clicking a resource
  MUST provide a context menu with applicable actions (restart, delete, scale, cordon).
- **FR-015**: All destructive actions (delete, restart) MUST require a confirmation
  dialog before executing.
- **FR-016**: In read-only mode (`READ_ONLY=true`, default), no mutation context menus
  or action buttons MUST be accessible.
- **FR-017**: Network traffic between services MUST be visualized as moving units
  (carts, horses, messengers) on the road network, with visual state reflecting
  latency across four levels — Normal (smooth-flowing), Elevated (slowed, bunching),
  High (congestion, dust clouds), and Critical (road blockage / overturned cart).
  Failed requests MUST appear as red carts that crash or catch fire (Tier 2).
- **FR-018**: When an incident occurs, the city MUST enter incident mode: affected
  buildings pulse red, failure propagation glows along dependency roads (Tier 2).
  Propagation MUST follow the Tier-2 traffic edges already visualized on the roads
  (simulated in mock mode; observed traffic for real clusters).
- **FR-019**: Ambient audio (city sounds, event cues, incident alarms) MUST be present
  with a mute toggle in the HUD (Tier 2).
- **FR-020**: The system MUST color-code node buildings by node health status:
  Ready (fully illuminated, banners flying), ResourcePressure (orange glow, congested
  surrounding roads), and Unreachable (dark building, red emergency beacon, blocked
  roads). Node health MUST be readable at a glance without clicking (Tier 1).
- **FR-021**: When write mode is enabled, the resource context menu MUST provide
  "View Logs" and "Describe" actions for applicable resources, opening a readable
  panel of the resource's logs or full description respectively (Tier 2).
- **FR-022**: The city MUST render varied terrain — grass, dirt paths, stone roads,
  water features, and elevation changes — to read as a believable medieval landscape
  rather than a flat plane (Tier 1).
- **FR-023**: The system MUST render the extended Tier-2 resource types as their
  city counterparts per the Resource-to-City Mapping table — Ingress (city gate),
  LoadBalancer (crossroads/interchange), StatefulSet (numbered townhouses), DaemonSet
  (watchtower per node), Job (traveling merchant), CronJob (scheduled merchant),
  PersistentVolume/PVC (warehouse), HPA (construction foreman), ConfigMap (wells/
  signposts), and Secret (fortified vault). Each MUST be visually distinct from the
  core building types (Tier 2).
- **FR-024**: When a user pastes a kubeconfig, the system MUST hold it in server
  memory for the active session only — it MUST NOT be written to disk — and MUST
  discard it on disconnect or server restart (Tier 1, security).
- **FR-025**: When connected to a real cluster, the system MUST source live CPU/memory
  usage from the Kubernetes Metrics API. If metrics-server is unavailable, the system
  MUST display capacity/requests where known and mark live usage as "N/A" rather than
  failing or blocking the city render (Tier 1).
- **FR-026**: In Tier 1, service roads MUST connect each Service to the pod-houses it
  selects (via its selector). Service-to-service dependency roads are derived from
  traffic data in Tier 2 (FR-017) and are out of scope for Tier 1.

### Key Entities

- **Cluster**: The entire city. Top-level container for all resources.
- **Namespace**: A walled district within the city. Has its own character
  (production = stone; staging = timber; dev = construction; kube-system = citadel).
- **Node**: A large landmark building (castle, tower, guild hall) within a district.
- **Pod**: A house or dwelling within a district. Health state drives visual appearance.
- **Container**: A room inside a pod/dwelling.
- **Service**: A road or trade route connecting buildings.
- **Deployment**: A village block — a named grouping of pod houses in a district.
- **Traffic Flow**: Moving carts, horses, or messengers on the roads.

### Resource-to-City Mapping (All Tiers)

Per constitution Principle II, every Kubernetes resource type in `PROMPT.md` MUST have a
city counterpart. The table below assigns each type to the tier in which its rendering
is delivered. Tier 1 renders the core city; later tiers enrich it.

| Kubernetes Resource | City Representation | Tier |
|---------------------|---------------------|------|
| Cluster | Entire City | 1 |
| Namespace | District / Walled Quarter | 1 |
| Node | Large building (castle, tower, guild hall) | 1 |
| Pod | House / Dwelling | 1 |
| Container | Room inside a dwelling | 1 |
| Service | Road / Trade Route | 1 |
| Deployment | Village Block / Hamlet | 1 |
| Ingress | City Gate | 2 |
| Load Balancer | Crossroads / Highway Interchange | 2 |
| StatefulSet | Row of numbered townhouses | 2 |
| DaemonSet | Watchtower (one per node) | 2 |
| Job | Traveling merchant (arrives, works, leaves) | 2 |
| CronJob | Scheduled market day | 2 |
| PersistentVolume / PVC | Warehouse / Storage barn | 2 |
| HPA (Autoscaler) | Construction foreman | 2 |
| ConfigMap | Utility infrastructure (wells, signposts) | 2 |
| Secret | Fortified vault | 2 |
| NetworkPolicy | Walls and gates between districts | 3 |
| CRD (Custom Resource) | Exotic / foreign-style building | 3 |
| Database | Treasury | 3 |
| Queue | Caravan post / Market stall | 3 |
| Network Traffic | Carts, horses, messengers on roads | 2 |

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user unfamiliar with the tool can identify the health status of any
  visible pod within 3 seconds of the city loading, without clicking anything.
- **SC-002**: The city loads and renders a 30-pod synthetic cluster within 5 seconds of
  the user selecting demo mode.
- **SC-003**: The city maintains smooth rendering (60 fps, no visible stutter) for
  clusters of 500–1,000 pods when viewed at mid zoom on a modern laptop.
- **SC-004**: Live cluster state changes (pod status updates) are visually reflected in
  the city within 3 seconds of the underlying event.
- **SC-005**: A new user completes the "load demo, find a failing pod, and inspect it"
  journey in under 2 minutes on first use.
- **SC-006**: 100% of Tier 1 resource types (namespace, node, pod, service, deployment)
  are visually represented and distinguishable from each other in the city view.
- **SC-007**: The resource bar HUD remains accurate and updates within 3 seconds of
  any cluster change.

---

## Assumptions

- Users run the application locally on their own machine; no cloud hosting or multi-user
  access is required.
- Demo mode is the primary onboarding path — users do not need a real cluster to
  evaluate the product.
- The application runs in a modern desktop browser (Chrome, Firefox, Safari, Edge);
  mobile browser support is out of scope.
- Audio is enabled by default but can be muted via a persistent HUD toggle; no audio
  settings panel is needed beyond mute/unmute.
- Only one cluster is in scope for Tier 1 and Tier 2; multi-cluster (world map) is a
  Tier 3 capability.
- The city uses a fixed warm golden-hour lighting aesthetic — no user-configurable
  themes or day/night cycle.
- Drag box-select and right-click context menus follow standard desktop conventions;
  touch/gesture equivalents are out of scope.
- Real cluster connectivity requires the user to supply a valid kubeconfig; no in-app
  cluster provisioning is provided. The kubeconfig is session-scoped and held in memory
  only — reconnecting after a server restart requires re-pasting it.
- Live resource-usage metrics depend on the Kubernetes Metrics API (metrics-server);
  when it is absent, usage-derived visuals degrade gracefully rather than failing.
- All 3D building models are sourced from free/open-license asset packs; no custom
  modeled geometry is required for core resource types.

---

## Out of Scope (Deferred — Tier 3)

The following capabilities from `PROMPT.md` are intentionally deferred to Tier 3 and are
**not** part of this specification's delivery. They are listed here so the deferral is an
explicit decision, not an oversight. Each will require its own spec when prioritized.

- **Security visualization** — intruders at gates, red alert zones, blocked roads for
  network-policy violations, shadowy figures for suspicious traffic, privilege-escalation
  (scaling castle walls).
- **Distributed trace paths** — following a single request's journey (OpenTelemetry /
  Jaeger / Tempo) as a highlighted route through every building it visits.
- **Multi-cluster world map** — multiple clusters as multiple cities connected by trade
  routes, with click-to-zoom navigation between cities.
- **Full observability integrations** — Prometheus / VictoriaMetrics / Datadog metrics
  driving building height and lighting; Loki / Elasticsearch log anomalies as smoke
  signals and rooftop flags.
- **Tier-3 resource renderings** — NetworkPolicy (walls/gates), CRD (exotic buildings),
  Database (treasury), and Queue (caravan post), per the Resource-to-City Mapping table.
