# Contract: REST API

**Base URL**: `http://localhost:3001`
**Format**: JSON
**Auth**: None (local-only tool)

The REST surface is minimal — the primary interface is WebSocket. REST endpoints
exist only for health checking and environment introspection.

---

## GET /health

Server liveness check.

**Response** `200 OK`:
```json
{
  "status": "ok",
  "mode": "mock",
  "readOnly": true,
  "uptime": 42.3
}
```

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok"` | Always `"ok"` if server is running |
| `mode` | `"mock" \| "live"` | Current cluster mode |
| `readOnly` | `boolean` | Value of `READ_ONLY` env var |
| `uptime` | `number` | Server uptime in seconds |

---

## GET /env

Returns the current environment configuration so the frontend can display it in the HUD.

**Response** `200 OK`:
```json
{
  "mockMode": true,
  "readOnly": true,
  "wsUrl": "ws://localhost:3001"
}
```

---

## Notes

- No authentication endpoints — this is a local developer tool.
- No REST endpoints for Kubernetes actions — all mutations go through the WebSocket
  `ACTION_*` message protocol (Tier 2 only).
- WebSocket upgrade happens on the same port (3001). Express handles HTTP; the `ws`
  library handles WebSocket upgrade on the same server instance.
