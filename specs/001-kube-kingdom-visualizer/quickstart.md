# Quickstart: Kube Kingdom

**Prerequisites**: Node.js 20 LTS+, npm 10+

---

## 1. Install

```bash
# From the repo root
npm install
```

This installs dependencies for both `client/` and `server/` via npm workspaces.

---

## 2. Run (Demo Mode)

```bash
npm run dev
```

Opens:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

The landing screen appears. Click **Explore Demo** — the mock city loads immediately
with a synthetic cluster (~30 pods across 4 namespaces).

---

## 3. Run (Real Cluster)

```bash
MOCK_MODE=false KUBECONFIG=~/.kube/config npm run dev
```

On the landing screen, click **Connect Cluster**. Paste your kubeconfig if it wasn't
auto-loaded from `KUBECONFIG`. The city populates from your live cluster.

---

## 4. Enable Write Actions

```bash
READ_ONLY=false npm run dev
```

Right-click any building to access the action context menu (restart, scale, delete).
All destructive actions require a confirmation dialog.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_MODE` | `true` | `true` = synthetic demo data |
| `READ_ONLY` | `true` | `true` = observe only, no mutations |
| `KUBECONFIG` | `~/.kube/config` | Path to kubeconfig (ignored when `MOCK_MODE=true`) |
| `PORT` | `3001` | Backend port |
| `VITE_WS_URL` | `ws://localhost:3001` | WebSocket URL for frontend |

---

## Camera Controls

| Action | Control |
|--------|---------|
| Pan | WASD or click + drag |
| Zoom | Scroll wheel |
| Rotate | Middle-mouse drag |
| Jump to district | Click minimap |
| Select resource | Left-click building |
| Box-select | Left-click + drag |
| Context menu | Right-click (write mode only) |

---

## Validation Checklist

After running, confirm:
- [ ] Landing screen shows "Kube Kingdom" with Demo / Connect buttons
- [ ] Demo loads city with ≥3 walled districts and ≥20 houses
- [ ] kube-system district is at the center of the city
- [ ] At least one pod shows red/amber health effects
- [ ] HUD resource bar shows pod count, node count, CPU%, memory%
- [ ] Minimap renders in the corner; clicking jumps camera to district
- [ ] Clicking a house opens the parchment detail panel
- [ ] Expand button in detail panel shows full resource details
- [ ] Camera pan/zoom/rotate all work smoothly
- [ ] 60 fps maintained at mid-zoom with full demo city
