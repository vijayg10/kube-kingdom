# Kube Kingdom

![Kube Kingdom](assets/images/kube-kingdom.png)

Your Kubernetes cluster, rendered as a living isometric medieval city.

Namespaces are walled districts. Nodes are castles and guild halls. Pods are houses. Services are roads. Traffic is carts and messengers. Health is visible at a glance — green means thriving, red means fire.

Built with React Three Fiber + Three.js for the 3D world, Express + WebSockets for live cluster data.

---

## Resource Mapping

| Kubernetes | City |
|---|---|
| Cluster | Entire city |
| Namespace | Walled district |
| Node | Castle / Guild Hall |
| Pod | House / Dwelling |
| Service | Road / Trade Route |
| Ingress | City Gate |
| Load Balancer | Crossroads |
| Deployment | Village Block |
| StatefulSet | Row of numbered townhouses |
| DaemonSet | Watchtower (one per node) |
| Job | Traveling merchant |
| CronJob | Scheduled market day |
| PersistentVolume / PVC | Warehouse / Storage Barn |
| ConfigMap | Wells and signposts |
| Secret | Fortified vault |
| NetworkPolicy | Walls and gates between districts |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| 3D Engine | Three.js via React Three Fiber + Drei |
| State | Zustand |
| Backend | Node.js + TypeScript (Express + WebSockets) |
| Kubernetes Client | `@kubernetes/client-node` |

---

## Prerequisites

- Node.js >= 20
- A Kubernetes cluster (optional — mock mode works without one)

---

## Getting Started

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Start both client and server
npm run dev
```

The frontend runs at `http://localhost:5173`. The backend WebSocket server runs at `ws://localhost:3001`.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MOCK_MODE` | `true` | `true` = synthetic demo cluster, `false` = connect to a real cluster |
| `READ_ONLY` | `true` | `true` = observe only, `false` = enable restart / scale / delete actions |
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig (used when `MOCK_MODE=false`) |
| `PORT` | `3001` | Backend HTTP + WebSocket port |
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket URL the frontend connects to |

---

## Modes

**Demo mode** (`MOCK_MODE=true`): The backend generates a realistic synthetic cluster — 3 nodes, 4–5 namespaces, ~30 pods, services, and live traffic — so the city looks alive without a real cluster.

**Live mode** (`MOCK_MODE=false`): The backend connects to your Kubernetes cluster via kubeconfig and streams live updates over WebSockets. You can also paste a kubeconfig at runtime via the Connect Cluster screen.

---

## Controls

| Input | Action |
|---|---|
| Click | Select and inspect a resource |
| Drag | Box-select multiple resources |
| Right-click | Context menu (actions when `READ_ONLY=false`) |
| WASD / edge scroll | Pan camera |
| Scroll wheel | Zoom |
| Middle-mouse drag | Rotate |
| Minimap click | Jump to a district |

---

## Health Visualization

| Pod Status | Visual |
|---|---|
| Running | Green-lit house, normal activity |
| Restarting | Amber house, flashing lantern |
| CrashLoopBackOff | Red house, smoke and fire effects |
| Pending | Gray house under construction |
| Evicted | Ruined / collapsed structure |

---

## Scripts

```bash
npm run dev          # Start client + server concurrently
npm run dev:client   # Client only
npm run dev:server   # Server only
npm run build        # Build both packages
npm run lint         # ESLint
npm run format       # Prettier
```

---

## Project Structure

```
kube-kingdom/
├── client/          # React + Three.js frontend
│   └── src/
├── server/          # Express + WebSocket backend
│   └── src/
├── .env.example     # Environment variable reference
└── package.json     # Monorepo root
```
