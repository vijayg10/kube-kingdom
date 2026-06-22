# Contract: WebSocket Protocol

**Interface**: WebSocket — `ws://localhost:3001`
**Transport**: JSON over WebSocket (`ws` library)
**Direction**: Bidirectional (server pushes state; client sends actions in Tier 2)

---

## Message Envelope

All messages (both directions) follow this envelope:

```typescript
interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;  // Unix ms (Date.now())
}
```

---

## Server → Client Messages

### CLUSTER_SNAPSHOT
Sent once on connection. Full current cluster state.

```typescript
{
  type: 'CLUSTER_SNAPSHOT';
  payload: ClusterState;
  timestamp: number;
}
```
**When**: Immediately after client sends `CONNECT_MOCK` or `CONNECT_CLUSTER`.
**Client action**: Replace entire `clusterStore` state; trigger layout generation.

---

### POD_UPDATED
A pod was created, modified, or its status changed.

```typescript
{
  type: 'POD_UPDATED';
  payload: Pod;
  timestamp: number;
}
```
**When**: Any pod Watch event (`ADDED` or `MODIFIED`).
**Client action**: Upsert pod in `clusterStore.pods`; update instance color in next frame.

---

### POD_DELETED

```typescript
{
  type: 'POD_DELETED';
  payload: { uid: string; namespace: string };
  timestamp: number;
}
```
**Client action**: Remove pod from store; remove building from city layout.

---

### NODE_UPDATED

```typescript
{
  type: 'NODE_UPDATED';
  payload: KubeNode;
  timestamp: number;
}
```

---

### NAMESPACE_UPDATED

```typescript
{
  type: 'NAMESPACE_UPDATED';
  payload: Namespace;
  timestamp: number;
}
```
**Client action**: Upsert namespace. If new, add district to layout (outer ring).

---

### NAMESPACE_DELETED

```typescript
{
  type: 'NAMESPACE_DELETED';
  payload: { name: string };
  timestamp: number;
}
```

---

### SERVICE_UPDATED

```typescript
{
  type: 'SERVICE_UPDATED';
  payload: KubeService;
  timestamp: number;
}
```

---

### DEPLOYMENT_UPDATED

```typescript
{
  type: 'DEPLOYMENT_UPDATED';
  payload: Deployment;
  timestamp: number;
}
```

---

### SUMMARY_UPDATED
Sent every 5 seconds with updated cluster-level metrics for the HUD resource bar.

```typescript
{
  type: 'SUMMARY_UPDATED';
  payload: ClusterSummary;
  timestamp: number;
}
```

---

### TRAFFIC_EVENT (Tier 2)
Simulated or real traffic data for road animation.

```typescript
{
  type: 'TRAFFIC_EVENT';
  payload: TrafficEvent;
  timestamp: number;
}
```

---

### ERROR

```typescript
{
  type: 'ERROR';
  payload: { code: string; message: string };
  timestamp: number;
}
```
**Codes**: `KUBECONFIG_INVALID`, `CLUSTER_UNREACHABLE`, `WATCH_FAILED`, `ACTION_DENIED`

---

## Client → Server Messages

### CONNECT_MOCK
Start a mock session. Server generates synthetic cluster and begins streaming updates.

```typescript
{
  type: 'CONNECT_MOCK';
  payload: null;
  timestamp: number;
}
```

---

### CONNECT_CLUSTER
Connect to a real Kubernetes cluster using the provided kubeconfig.

```typescript
{
  type: 'CONNECT_CLUSTER';
  payload: { kubeconfig: string };  // Full kubeconfig YAML content
  timestamp: number;
}
```
**Server response**: `CLUSTER_SNAPSHOT` on success, `ERROR` on failure.

---

### ACTION_RESTART_POD (Tier 2 — `READ_ONLY=false` only)

```typescript
{
  type: 'ACTION_RESTART_POD';
  payload: { name: string; namespace: string };
  timestamp: number;
}
```
**Server response**: `POD_UPDATED` event(s) reflecting restart, or `ERROR`.

---

### ACTION_DELETE_POD (Tier 2 — `READ_ONLY=false` only)

```typescript
{
  type: 'ACTION_DELETE_POD';
  payload: { name: string; namespace: string };
  timestamp: number;
}
```

---

### ACTION_SCALE_DEPLOYMENT (Tier 2 — `READ_ONLY=false` only)

```typescript
{
  type: 'ACTION_SCALE_DEPLOYMENT';
  payload: { name: string; namespace: string; replicas: number };
  timestamp: number;
}
```

---

### ACTION_CORDON_NODE (Tier 2 — `READ_ONLY=false` only)

```typescript
{
  type: 'ACTION_CORDON_NODE';
  payload: { name: string; cordon: boolean };  // true = cordon, false = uncordon
  timestamp: number;
}
```

---

## Connection Lifecycle

```
Client                          Server
  │                               │
  │──── WebSocket connect ────────►│
  │                               │ (validate env, init watcher/mock)
  │◄─── CLUSTER_SNAPSHOT ─────────│
  │                               │
  │◄─── POD_UPDATED ──────────────│  (streaming, ongoing)
  │◄─── SUMMARY_UPDATED ──────────│  (every 5s)
  │                               │
  │──── ACTION_* ─────────────────►│  (Tier 2 only, READ_ONLY=false)
  │◄─── POD_UPDATED / ERROR ──────│
  │                               │
  │     [disconnect]              │
  │◄────────────────── close ─────│
  │                               │
  │──── reconnect (backoff) ──────►│
  │◄─── CLUSTER_SNAPSHOT ─────────│  (full re-sync on reconnect)
```

**Reconnection policy** (client): Exponential backoff — 1s, 2s, 4s, 8s, 16s.
After 5 failed attempts, show error state in HUD. User can manually retry.
