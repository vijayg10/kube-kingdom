# Kube Kingdom

Build me a fully interactive Kubernetes cluster visualizer styled like Age of Empires -- a top-down isometric 3D medieval city in the browser.

Instead of dashboards and tables, my Kubernetes cluster is rendered as a living medieval city viewed from above. I observe, select, inspect, and manage resources the way an RTS player manages a kingdom.

---

## Architecture

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + TypeScript (Express + WebSockets)
- **3D Engine:** Three.js via React Three Fiber + drei
- **Monorepo:** Two npm packages -- `client/` and `server/`
- **No deployment target** -- runs locally via `npm run dev`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_MODE` | `true` | `true` = synthetic demo data, `false` = connect to real K8s cluster |
| `READ_ONLY` | `true` | `true` = observe only, `false` = enable actions (restart, scale, delete) |
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig (only used when `MOCK_MODE=false`) |

---

## Data Connectivity

- When `MOCK_MODE=true`: Backend generates a realistic synthetic cluster (3 nodes, 4-5 namespaces, ~30 pods, services, traffic) so the city looks alive without a real cluster.
- When `MOCK_MODE=false`: Backend connects to a real Kubernetes cluster via the provided kubeconfig. Uses the K8s watch API for live updates over WebSockets to the frontend.

---

## Onboarding

Landing screen with the project name "Kube Kingdom" and two buttons:

- **Explore Demo** -- enters mock mode, loads a full living city immediately
- **Connect Cluster** -- presents a form to paste kubeconfig contents, then enters the real city

---

## Core Resource Mapping

| Kubernetes Resource | City Representation |
|---------------------|----------------------|
| Cluster | Entire City |
| Namespace | District / Walled Quarter |
| Node | Large building (castle, tower, guild hall) |
| Pod | House / Dwelling |
| Container | Room inside a dwelling |
| Service | Road / Trade Route |
| Ingress | City Gate |
| Load Balancer | Crossroads / Highway Interchange |
| Deployment | Village Block / Hamlet |
| StatefulSet | Row of numbered townhouses (ordered, persistent identity) |
| DaemonSet | Watchtower (one per node, always present) |
| Job | Traveling merchant (arrives, does work, leaves) |
| CronJob | Scheduled market day (merchant arrives on schedule) |
| PersistentVolume / PVC | Warehouse / Storage barn |
| HPA (Autoscaler) | Construction foreman (adds/removes houses automatically) |
| ConfigMap | Utility infrastructure (wells, signposts) |
| Secret | Fortified vault |
| NetworkPolicy | Walls and gates between districts |
| CRD (Custom Resource) | Exotic / foreign-style building |
| Database | Treasury |
| Queue | Caravan post / Market stall |
| Network Traffic | Carts, horses, messengers moving along roads |

---

## Visual Style

Make it look like a real game -- not blobby placeholder geometry.

- **Isometric / top-down RTS camera** with smooth pan, zoom, and rotation
- **Use free downloadable 3D models** (glTF/GLB) from sources like Kenney, poly.pizza, Sketchfab (CC0/CC-BY), or Quaternius for buildings, terrain, units, trees, props. Do NOT model everything from scratch with basic geometry.
- **Proper lighting and shadows** -- directional sunlight, ambient occlusion, soft shadows on the ground plane
- **Fixed golden-hour lighting** -- always warm, beautiful, and readable. No day/night cycle.
- **Terrain with variety** -- grass, dirt paths, stone roads, water features, elevation changes
- **Readable silhouettes** -- each building type visually distinct at a glance (a castle looks different from a market, a vault looks different from a house)
- **Atmospheric polish** -- fog of distance, subtle particle effects (smoke from chimneys, dust on roads)
- **Minimap** in the corner showing the full city layout with color-coded districts
- **Resource bar / HUD** at the top showing cluster-level stats (total pods, nodes, CPU, memory)

---

## Level of Detail (LOD)

Large clusters can have thousands of pods. Handle this with LOD:

- **Zoomed out:** Districts appear as walled areas with density/color indicators. Individual buildings are not rendered.
- **Mid zoom:** Buildings render as simplified low-poly models. Roads visible.
- **Zoomed in:** Full detail -- individual buildings with props, animated units, particle effects, readable labels.

This keeps performance smooth regardless of cluster size.

---

## City Layout Generation

Use **organic procedural layout** -- the city should feel like a real medieval city, not a grid.

- Namespaces get irregular-shaped plots with walls, like a real medieval city's districts
- Roads follow service connections between resources
- Buildings fill in organically within each district
- `kube-system` is the castle / citadel at the center
- Layout should be stable -- adding a pod doesn't rearrange the entire city, it adds a new house in the district

---

## Controls

Classic RTS-style:

- **Click** a building/unit to select and inspect it (shows detail panel)
- **Drag** to box-select multiple resources
- **Right-click** for context menu (view logs, describe, scale, restart -- only if `READ_ONLY=false`)
- **WASD or edge-scroll** to pan camera
- **Scroll wheel** to zoom
- **Middle-mouse drag** to rotate
- **Minimap click** to jump to a district

---

## Detail Panel (on click)

**Layered approach:**

- **Summary view (default):** Health status, key metrics (CPU/memory), age, restart count, key labels -- styled as a medieval parchment/scroll to match the theme.
- **Expand button:** Reveals full `kubectl describe` level detail -- events, conditions, volumes, env vars, annotations -- in a scrollable panel.

---

## Actions (when `READ_ONLY=false`)

Right-click context menu on resources:

- Pod → Restart / Delete
- Deployment → Scale up/down (foreman builds or demolishes houses)
- Node → Cordon / Uncordon (barriers go up around the building)
- Any resource → View logs, Describe

All destructive actions require a confirmation dialog.

---

## Real-Time Health Visualization

### Pod Health

| Status | Visual |
|--------|--------|
| Healthy | Green-lit house, normal activity, villagers milling about |
| Restarting | Yellow/amber house, flashing lantern, repair cart nearby |
| CrashLoopBackOff | Red house, smoke/fire effects, alarm bell ringing |
| Pending | Gray house under construction, scaffolding visible |
| Evicted | Ruined / collapsed structure |

### Node Health

| Status | Visual |
|--------|--------|
| Healthy | Fully illuminated building, banners flying |
| Resource Pressure | Orange glow, congested surrounding roads |
| Unreachable | Dark building, red emergency beacon, roads blocked |

---

## Traffic Visualization

Every request becomes a moving cart, horse, or messenger on the roads.

```
Client
  --> City Gate (Ingress)
    --> Crossroads (Load Balancer)
      --> Guild Hall (API Service)
        --> Treasury (Database)
```

Carts move between buildings in real time along the road network.

### Latency

| Latency | Visual |
|---------|--------|
| Normal | Smooth-flowing carts |
| Elevated | Slow traffic, carts bunching up |
| High | Road congestion, dust clouds |
| Critical | Road blockage, overturned cart |

### Errors

- Failed requests = red carts that crash or catch fire
- Alert flags raised on affected buildings

---

## District View

Each namespace is a walled district with its own character:

- **Production** -- Grand stone buildings, heavy traffic, guarded gates
- **Staging** -- Modest timber buildings, moderate activity
- **Development** -- Construction zones, experimental structures, fewer guards
- **kube-system** -- The castle / citadel at the center of the city

---

## Incident Mode

When something goes wrong, the city visually reacts:

- Affected buildings glow red and pulse
- Failure propagation shown as a spreading red glow along roads
- Dependency chains become visible as highlighted paths
- Warning bells and alarm horns sound

Example: Database failure cascades through payment-service, transfer-service, and API gateway -- the entire path from treasury to city gate glows red.

---

## Security Visualization

- Unauthorized access = intruders at the gates, red alert zones
- Network policy violations = blocked roads with barriers
- Suspicious traffic = shadowy figures on roads
- Privilege escalation = someone scaling castle walls

---

## Audio

Full ambient audio for immersion (with mute button in HUD):

- **Background:** Medieval ambient music, birds chirping, wind
- **City sounds:** Cart wheels on roads, hammering in construction zones, market chatter
- **Events:** Alarm bells during incidents, notification chimes on status changes, click feedback sounds
- **Incident mode:** Warning horns, intensified music

---

## Observability Layer

### Metrics (Prometheus / VictoriaMetrics / Datadog)

Visualized as:
- Building height = resource usage
- Lighting intensity = request rate
- Traffic volume on roads = throughput

### Logs (Loki / Elasticsearch)

Log anomalies appear as:
- Smoke signals from buildings
- Warning flags on rooftops
- Alarm bells

### Traces (OpenTelemetry / Jaeger / Tempo)

Distributed traces become visible routes -- follow a single cart's journey from city gate through every building it visits.

---

## Multi-Cluster

Multiple clusters = multiple cities on a world map, connected by trade routes (highways / bridges / sea lanes). Click a city on the world map to zoom into it.

---

## 3D Assets

All models in glTF/GLB format from free sources:

- Kenney.nl asset packs (medieval/city)
- Quaternius free packs
- poly.pizza (CC0 models)
- Sketchfab (CC-BY/CC0 models)

---

## Scope / Tiers

### Tier 1 -- MVP

- City renders from cluster data (mock or real)
- Namespaces as districts, nodes as buildings, pods as houses, services as roads
- Health color-coding (green/yellow/red)
- Click to inspect (detail panel with summary + expand)
- RTS camera controls (pan, zoom, rotate)
- Minimap and resource bar HUD
- Landing screen with Demo / Connect options
- Mock mode with realistic synthetic data
- LOD system for performance

### Tier 2

- Traffic visualization (carts moving along roads)
- Incident mode (failure cascading glow + audio)
- Log/metric-driven visual effects (smoke, alarms, flags)
- Full ambient audio
- Actions (restart, scale, delete) with `READ_ONLY=false`

### Tier 3

- Security visualization (intruders, barriers, shadowy figures)
- Distributed trace paths
- Multi-cluster world map
- Full observability integrations (Prometheus, Loki, Jaeger)

---

## Target Users

- SRE Teams
- Platform Engineers
- DevOps Teams
- Security Teams
- Kubernetes Operators

---

## [CHECK-INS]

Check in with me at key decision points instead of deciding silently:

1. Before building the world -- present 3 visual style directions labeled A/B/C with a one-line tradeoff each, and wait for my pick.
2. Before choosing the 3D model packs -- show me 3 options with links and previews so I can approve the aesthetic.
3. For any major scoping decision -- including what to cut if the full feature set won't fit in one shot.
