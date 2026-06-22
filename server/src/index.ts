import { createServer } from 'node:http';
import express from 'express';
import { config } from './config.js';
import { Broadcaster } from './ws/broadcaster.js';

const app = express();
app.use(express.json());

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
