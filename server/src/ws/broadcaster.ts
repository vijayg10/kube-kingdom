import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AppConfig } from '../config.js';
import type { ClientMessage, ServerMessage } from '../types/cluster.js';
import type { ClusterSource } from '../k8s/clusterSource.js';
import { MockCluster } from '../k8s/mockCluster.js';
import { K8sWatcher } from '../k8s/watcher.js';

/**
 * Owns the WebSocket server, the connected-client registry, and the active
 * cluster data source. A single shared source feeds every client (this is a
 * single-cluster, single-user local tool — see research.md §3).
 */
export class Broadcaster {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private source?: ClusterSource;
  private mode: 'mock' | 'live' = 'mock';

  constructor(
    httpServer: HttpServer,
    private config: AppConfig,
  ) {
    this.mode = this.config.mockMode ? 'mock' : 'live';
    this.wss = new WebSocketServer({ server: httpServer });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  /** Current mode, surfaced via GET /health. */
  getMode(): 'mock' | 'live' {
    return this.mode;
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);

    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        this.sendTo(ws, {
          type: 'ERROR',
          payload: { code: 'WATCH_FAILED', message: 'Malformed message' },
          timestamp: Date.now(),
        });
        return;
      }
      this.handleClientMessage(ws, msg);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'CONNECT_MOCK':
        this.startMock();
        this.sendConfig(ws);
        this.sendSnapshot(ws);
        break;

      case 'CONNECT_CLUSTER':
        this.startLive(msg.payload.kubeconfig);
        this.sendConfig(ws);
        this.sendSnapshot(ws);
        break;

      case 'ACTION_RESTART_POD':
        if (this.config.readOnly) { this.denyAction(ws); break; }
        void this.restartPod(ws, msg.payload.name, msg.payload.namespace);
        break;

      case 'ACTION_DELETE_POD':
        if (this.config.readOnly) { this.denyAction(ws); break; }
        void this.deletePod(ws, msg.payload.name, msg.payload.namespace);
        break;

      case 'ACTION_SCALE_DEPLOYMENT':
        if (this.config.readOnly) { this.denyAction(ws); break; }
        void this.scaleDeployment(ws, msg.payload.name, msg.payload.namespace, msg.payload.replicas);
        break;

      case 'ACTION_CORDON_NODE':
        if (this.config.readOnly) { this.denyAction(ws); break; }
        void this.cordonNode(ws, msg.payload.name, msg.payload.cordon);
        break;

      case 'ACTION_VIEW_LOGS':
        void this.viewLogs(ws, msg.payload.name, msg.payload.namespace, msg.payload.container);
        break;

      case 'ACTION_DESCRIBE':
        void this.describeResource(ws, msg.payload.kind, msg.payload.name, msg.payload.namespace);
        break;
    }
  }

  private denyAction(ws: WebSocket): void {
    this.sendTo(ws, {
      type: 'ERROR',
      payload: { code: 'ACTION_DENIED', message: 'Server is in read-only mode.' },
      timestamp: Date.now(),
    });
  }

  private sendConfig(ws: WebSocket): void {
    this.sendTo(ws, {
      type: 'SERVER_CONFIG',
      payload: { readOnly: this.config.readOnly, mockMode: this.config.mockMode },
      timestamp: Date.now(),
    });
  }

  private async restartPod(ws: WebSocket, name: string, namespace: string): Promise<void> {
    const result = await this.source?.restartPod?.(name, namespace) ??
      { action: 'restart', target: `${namespace}/${name}`, success: false, message: 'No source' };
    this.sendTo(ws, { type: 'ACTION_RESULT', payload: result, timestamp: Date.now() });
  }

  private async deletePod(ws: WebSocket, name: string, namespace: string): Promise<void> {
    const result = await this.source?.deletePod?.(name, namespace) ??
      { action: 'delete', target: `${namespace}/${name}`, success: false, message: 'No source' };
    this.sendTo(ws, { type: 'ACTION_RESULT', payload: result, timestamp: Date.now() });
  }

  private async scaleDeployment(ws: WebSocket, name: string, namespace: string, replicas: number): Promise<void> {
    const result = await this.source?.scaleDeployment?.(name, namespace, replicas) ??
      { action: 'scale', target: `${namespace}/${name}`, success: false, message: 'No source' };
    this.sendTo(ws, { type: 'ACTION_RESULT', payload: result, timestamp: Date.now() });
  }

  private async cordonNode(ws: WebSocket, name: string, cordon: boolean): Promise<void> {
    const result = await this.source?.cordonNode?.(name, cordon) ??
      { action: cordon ? 'cordon' : 'uncordon', target: name, success: false, message: 'No source' };
    this.sendTo(ws, { type: 'ACTION_RESULT', payload: result, timestamp: Date.now() });
  }

  private async viewLogs(ws: WebSocket, name: string, namespace: string, container?: string): Promise<void> {
    const payload = await this.source?.getLogs?.(name, namespace, container) ??
      { podName: name, namespace, lines: ['Log streaming not available'] };
    this.sendTo(ws, { type: 'LOGS_RESULT', payload, timestamp: Date.now() });
  }

  private async describeResource(ws: WebSocket, kind: string, name: string, namespace: string): Promise<void> {
    const payload = await this.source?.describeResource?.(kind, name, namespace) ??
      { kind, name, namespace, text: 'Describe not available' };
    this.sendTo(ws, { type: 'DESCRIBE_RESULT', payload, timestamp: Date.now() });
  }

  /** Lazily create and start the shared mock source the first time it is needed. */
  private startMock(): void {
    if (this.source && this.mode === 'mock') return;
    this.swapSource(new MockCluster(), 'mock');
  }

  /**
   * Start (or restart) a live cluster source from the provided kubeconfig.
   * The kubeconfig is held only in the watcher's memory and is discarded when
   * the source is stopped/replaced — never written to disk (FR-024).
   */
  private startLive(kubeconfig: string): void {
    try {
      this.swapSource(new K8sWatcher(kubeconfig), 'live');
    } catch (err) {
      this.broadcast({
        type: 'ERROR',
        payload: { code: 'KUBECONFIG_INVALID', message: String(err) },
        timestamp: Date.now(),
      });
    }
  }

  private swapSource(source: ClusterSource, mode: 'mock' | 'live'): void {
    this.source?.stop();
    this.source = source;
    this.mode = mode;
    source.on('message', (m: ServerMessage) => this.broadcast(m));
    source.start();
  }

  private sendSnapshot(ws: WebSocket): void {
    if (!this.source) return;
    this.sendTo(ws, {
      type: 'CLUSTER_SNAPSHOT',
      payload: this.source.getSnapshot(),
      timestamp: Date.now(),
    });
  }

  /** Send to a single client. */
  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /** Send to every connected client. */
  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  }

  /** Tear down the WS server and any active source. */
  close(): void {
    this.source?.stop();
    this.wss.close();
  }
}
