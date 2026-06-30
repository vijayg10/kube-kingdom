import { createServer } from 'node:http';
import express from 'express';
import * as k8s from '@kubernetes/client-node';
import { config } from './config.js';
import { Broadcaster } from './ws/broadcaster.js';

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

const startedAt = Date.now();
const httpServer = createServer(app);
const broadcaster = new Broadcaster(httpServer, config);

// REST surface (contracts/rest-api.md) — minimal: health + env introspection.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: broadcaster.getMode(),
    readOnly: config.readOnly,
    uptime: (Date.now() - startedAt) / 1000,
  });
});

// Returns mockMode + context names (no credentials, certs, or tokens).
app.get('/api/contexts', (_req, res) => {
  if (config.mockMode) {
    res.json({ mockMode: true, contexts: [], current: null });
    return;
  }
  try {
    // Unset KUBECONFIG if it contains an unexpanded ~ so loadFromDefault()
    // falls back to its own path resolution (which handles ~ correctly).
    if (process.env.KUBECONFIG?.startsWith('~')) delete process.env.KUBECONFIG;
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const contexts = kc.getContexts().map((c) => c.name);
    const current = kc.getCurrentContext();
    res.json({ mockMode: false, contexts, current: current ?? contexts[0] ?? null });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/env', (_req, res) => {
  res.json({
    mockMode: config.mockMode,
    readOnly: config.readOnly,
    wsUrl: config.wsUrl,
  });
});

httpServer.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[kube-kingdom] server listening on http://localhost:${config.port} ` +
      `(mode=${config.mockMode ? 'mock' : 'live'}, readOnly=${config.readOnly})`,
  );
});

function shutdown(): void {
  broadcaster.close();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
