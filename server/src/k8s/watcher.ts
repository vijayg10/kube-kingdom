import { EventEmitter } from 'node:events';
import * as k8s from '@kubernetes/client-node';
import type {
  ActionResult,
  ClusterState,
  ClusterSummary,
  Deployment,
  DescribePayload,
  KubeNode,
  KubeService,
  LogsPayload,
  Namespace,
  NamespaceTheme,
  NodeHealth,
  Pod,
  PodHealth,
  Secret,
} from '../types/cluster.js';
import { emitMessage, type ClusterSource } from './clusterSource.js';

const WATCH_PATHS = {
  pods: '/api/v1/pods',
  nodes: '/api/v1/nodes',
  namespaces: '/api/v1/namespaces',
  services: '/api/v1/services',
  deployments: '/apis/apps/v1/deployments',
  secrets: '/api/v1/secrets',
} as const;

const RECONNECT_MS = 3000;

function friendlyError(err: unknown): string {
  const msg = String(err);
  if (msg.includes('ECONNREFUSED')) return 'Cannot reach the cluster — connection refused. Retrying…';
  if (msg.includes('ETIMEDOUT') || msg.includes('ESOCKETTIMEDOUT')) return 'Cluster connection timed out. Retrying…';
  if (msg.includes('ENOTFOUND')) return 'Cluster hostname not found. Retrying…';
  if (msg.includes('certificate') || msg.includes('CERT') || msg.includes('SSL'))
    return 'TLS certificate error connecting to cluster. Retrying…';
  if (msg.includes('401') || msg.includes('Unauthorized')) return 'Unauthorized — check your cluster credentials. Retrying…';
  if (msg.includes('403') || msg.includes('Forbidden')) return 'Forbidden — insufficient permissions on the cluster. Retrying…';
  return 'Lost connection to cluster. Retrying…';
}
const METRICS_INTERVAL_MS = 10_000;
const SUMMARY_INTERVAL_MS = 5_000;

/**
 * Streams a real cluster's state over the Kubernetes Watch API
 * (research.md §6). One watch stream per resource type, each independently
 * reconnecting. CPU/memory come from the Metrics API; when metrics-server is
 * absent the values fall back to "N/A" (represented as -1) per FR-025.
 */
export class K8sWatcher extends EventEmitter implements ClusterSource {
  private kc: k8s.KubeConfig;
  private watch: k8s.Watch;
  private metrics: k8s.Metrics;

  private pods = new Map<string, Pod>();
  private nodes = new Map<string, KubeNode>();
  private namespaces = new Map<string, Namespace>();
  private services = new Map<string, KubeService>();
  private deployments = new Map<string, Deployment>();
  private secrets = new Map<string, Secret>();

  private requests: Array<{ abort(): void }> = [];
  private timers: Array<ReturnType<typeof setInterval>> = [];
  private stopped = false;

  private escalated = false;

  constructor(context?: string) {
    super();
    if (process.env.KUBECONFIG?.startsWith('~')) delete process.env.KUBECONFIG;
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    if (context) this.kc.setCurrentContext(context);
    this.watch = new k8s.Watch(this.kc);
    this.metrics = new k8s.Metrics(this.kc);
  }

  getSnapshot(): ClusterState {
    return {
      namespaces: [...this.namespaces.values()],
      nodes: [...this.nodes.values()],
      pods: [...this.pods.values()],
      services: [...this.services.values()],
      deployments: [...this.deployments.values()],
      ingresses: [],
      loadBalancers: [],
      statefulSets: [],
      daemonSets: [],
      jobs: [],
      persistentVolumes: [],
      hpas: [],
      configMaps: [],
      secrets: [...this.secrets.values()],
      summary: this.computeSummary(),
      snapshotAt: new Date().toISOString(),
    };
  }

  start(): void {
    this.stopped = false;
    this.startStream('pods', (phase, obj) => this.onPod(phase, obj));
    this.startStream('nodes', (phase, obj) => this.onNode(phase, obj));
    this.startStream('namespaces', (phase, obj) => this.onNamespace(phase, obj));
    this.startStream('services', (phase, obj) => this.onService(phase, obj));
    this.startStream('deployments', (phase, obj) => this.onDeployment(phase, obj));
    this.startStream('secrets', (phase, obj) => this.onSecret(phase, obj));
    // LIST secrets up-front so the first snapshot has them (the watch stream
    // is async and won't have delivered events by the time getSnapshot() is
    // called synchronously after start()). On completion, emit a new snapshot
    // to update any already-connected clients.
    void this.listSecrets();

    this.timers.push(
      setInterval(() => void this.pollMetrics(), METRICS_INTERVAL_MS),
      setInterval(() => {
        emitMessage(this, {
          type: 'SUMMARY_UPDATED',
          payload: this.computeSummary(),
          timestamp: Date.now(),
        });
      }, SUMMARY_INTERVAL_MS),
    );
    void this.pollMetrics();
  }

  stop(): void {
    this.stopped = true;
    this.requests.forEach((r) => {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
    });
    this.requests = [];
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  // --- Watch plumbing ----------------------------------------------------

  private async startStream(
    key: keyof typeof WATCH_PATHS,
    handler: (phase: string, obj: any) => void,
  ): Promise<void> {
    if (this.stopped) return;
    try {
      const req = await this.watch.watch(
        WATCH_PATHS[key],
        {},
        (phase, obj) => {
          // Successful event — reset retry tracking for this stream.
          this.streamRetries.set(key, 0);
          this.escalated = false;
          handler(phase, obj);
        },
        (err) => {
          if (this.stopped) return;
          if (err) this.handleStreamError(key, err);
          setTimeout(() => void this.startStream(key, handler), RECONNECT_MS);
        },
      );
      this.requests.push(req);
    } catch (err) {
      this.handleStreamError(key, err);
      setTimeout(() => void this.startStream(key, handler), RECONNECT_MS);
    }
  }

  private handleStreamError(_key: string, err: unknown): void {
    if (this.escalated) return;
    this.escalated = true;
    emitMessage(this, {
      type: 'ERROR',
      payload: { code: 'CLUSTER_UNREACHABLE', message: friendlyError(err) },
      timestamp: Date.now(),
    });
  }

  // --- Resource handlers -------------------------------------------------

  private onPod(phase: string, obj: any): void {
    const uid = obj?.metadata?.uid;
    if (!uid) return;
    if (phase === 'DELETED') {
      this.pods.delete(uid);
      emitMessage(this, {
        type: 'POD_DELETED',
        payload: { uid, namespace: obj.metadata.namespace ?? '' },
        timestamp: Date.now(),
      });
      return;
    }
    const pod = mapPod(obj, this.pods.get(uid));
    this.pods.set(uid, pod);
    emitMessage(this, { type: 'POD_UPDATED', payload: pod, timestamp: Date.now() });
  }

  private onNode(phase: string, obj: any): void {
    const name = obj?.metadata?.name;
    if (!name) return;
    if (phase === 'DELETED') {
      this.nodes.delete(name);
      return;
    }
    const node = mapNode(obj, this.podCountForNode(name));
    this.nodes.set(name, node);
    emitMessage(this, { type: 'NODE_UPDATED', payload: node, timestamp: Date.now() });
  }

  private onNamespace(phase: string, obj: any): void {
    const name = obj?.metadata?.name;
    if (!name) return;
    if (phase === 'DELETED') {
      this.namespaces.delete(name);
      emitMessage(this, { type: 'NAMESPACE_DELETED', payload: { name }, timestamp: Date.now() });
      return;
    }
    const ns: Namespace = {
      name,
      labels: obj.metadata.labels ?? {},
      theme: themeForNamespace(name),
    };
    this.namespaces.set(name, ns);
    emitMessage(this, { type: 'NAMESPACE_UPDATED', payload: ns, timestamp: Date.now() });
  }

  private onService(phase: string, obj: any): void {
    const uid = obj?.metadata?.uid;
    if (!uid) return;
    if (phase === 'DELETED') {
      this.services.delete(uid);
      return;
    }
    const svc: KubeService = {
      uid,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace ?? 'default',
      type: obj.spec?.type ?? 'ClusterIP',
      selector: obj.spec?.selector ?? {},
      ports: (obj.spec?.ports ?? []).map((p: any) => ({
        port: p.port,
        targetPort: typeof p.targetPort === 'number' ? p.targetPort : p.port,
        protocol: p.protocol ?? 'TCP',
      })),
    };
    this.services.set(uid, svc);
    emitMessage(this, { type: 'SERVICE_UPDATED', payload: svc, timestamp: Date.now() });
  }

  private onDeployment(phase: string, obj: any): void {
    const uid = obj?.metadata?.uid;
    if (!uid) return;
    if (phase === 'DELETED') {
      this.deployments.delete(uid);
      return;
    }
    const dep: Deployment = {
      uid,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace ?? 'default',
      replicas: obj.spec?.replicas ?? 0,
      readyReplicas: obj.status?.readyReplicas ?? 0,
      labels: obj.metadata.labels ?? {},
    };
    this.deployments.set(uid, dep);
    emitMessage(this, { type: 'DEPLOYMENT_UPDATED', payload: dep, timestamp: Date.now() });
  }

  private onSecret(phase: string, obj: any): void {
    const uid = obj?.metadata?.uid;
    if (!uid) return;
    if (phase === 'DELETED') {
      this.secrets.delete(uid);
      return;
    }
    this.secrets.set(uid, mapSecret(obj));
  }

  private async listSecrets(): Promise<void> {
    try {
      const api = this.kc.makeApiClient(k8s.CoreV1Api);
      const resp = await api.listSecretForAllNamespaces();
      if (this.stopped) return;
      for (const item of resp.body.items) {
        const uid = item.metadata?.uid;
        if (uid) this.secrets.set(uid, mapSecret(item));
      }
      // Push an updated snapshot so already-connected clients get the secrets.
      emitMessage(this, {
        type: 'CLUSTER_SNAPSHOT',
        payload: this.getSnapshot(),
        timestamp: Date.now(),
      });
    } catch {
      // RBAC may not permit listing secrets — skip silently.
    }
  }

  // --- Metrics -----------------------------------------------------------

  private async pollMetrics(): Promise<void> {
    try {
      const podMetrics = await this.metrics.getPodMetrics();
      for (const pm of podMetrics.items) {
        const pod = [...this.pods.values()].find(
          (p) => p.name === pm.metadata.name && p.namespace === pm.metadata.namespace,
        );
        if (!pod) continue;
        let cpu = 0;
        let mem = 0;
        for (const c of pm.containers) {
          cpu += parseCpuToMillicores(c.usage.cpu); // cores → millicores
          mem += parseMemToMiB(c.usage.memory); // bytes → MiB
        }
        pod.cpuMillicores = Math.round(cpu);
        pod.memoryMiB = Math.round(mem);
        emitMessage(this, { type: 'POD_UPDATED', payload: pod, timestamp: Date.now() });
      }
    } catch {
      // metrics-server absent → leave metrics as "N/A" (-1 sentinel, FR-025).
      for (const pod of this.pods.values()) {
        if (pod.cpuMillicores === 0 && pod.memoryMiB === 0) {
          pod.cpuMillicores = -1;
          pod.memoryMiB = -1;
        }
      }
    }
  }

  // --- Mutation actions (only when readOnly=false) -----------------------

  async restartPod(name: string, namespace: string): Promise<ActionResult> {
    try {
      const api = this.kc.makeApiClient(k8s.CoreV1Api);
      await api.deleteNamespacedPod(name, namespace);
      return { action: 'restart', target: `${namespace}/${name}`, success: true, message: 'Pod deleted — controller will restart it' };
    } catch (err) {
      return { action: 'restart', target: `${namespace}/${name}`, success: false, message: String(err) };
    }
  }

  async deletePod(name: string, namespace: string): Promise<ActionResult> {
    try {
      const api = this.kc.makeApiClient(k8s.CoreV1Api);
      await api.deleteNamespacedPod(name, namespace);
      return { action: 'delete', target: `${namespace}/${name}`, success: true, message: 'Pod deleted' };
    } catch (err) {
      return { action: 'delete', target: `${namespace}/${name}`, success: false, message: String(err) };
    }
  }

  async scaleDeployment(name: string, namespace: string, replicas: number): Promise<ActionResult> {
    try {
      const api = this.kc.makeApiClient(k8s.AppsV1Api);
      await api.patchNamespacedDeploymentScale(
        name,
        namespace,
        { spec: { replicas } },
        undefined, undefined, undefined, undefined, undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } },
      );
      return { action: 'scale', target: `${namespace}/${name}`, success: true, message: `Scaled to ${replicas}` };
    } catch (err) {
      return { action: 'scale', target: `${namespace}/${name}`, success: false, message: String(err) };
    }
  }

  async cordonNode(name: string, cordon: boolean): Promise<ActionResult> {
    try {
      const api = this.kc.makeApiClient(k8s.CoreV1Api);
      await api.patchNode(
        name,
        { spec: { unschedulable: cordon } },
        undefined, undefined, undefined, undefined, undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } },
      );
      return { action: cordon ? 'cordon' : 'uncordon', target: name, success: true, message: cordon ? 'Node cordoned' : 'Node uncordoned' };
    } catch (err) {
      return { action: cordon ? 'cordon' : 'uncordon', target: name, success: false, message: String(err) };
    }
  }

  async getLogs(name: string, namespace: string, container?: string): Promise<LogsPayload> {
    try {
      const api = this.kc.makeApiClient(k8s.CoreV1Api);
      const resp = await api.readNamespacedPodLog(name, namespace, container, undefined, undefined, undefined, undefined, undefined, undefined, 100);
      const text = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
      const lines = text.split('\n').filter(Boolean);
      return { podName: name, namespace, lines };
    } catch (err) {
      return { podName: name, namespace, lines: [`Error fetching logs: ${String(err)}`] };
    }
  }

  async describeResource(kind: string, name: string, namespace: string): Promise<DescribePayload> {
    try {
      const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      let obj: unknown;
      if (kind === 'Pod') {
        const r = await coreApi.readNamespacedPod(name, namespace);
        obj = r.body;
      } else if (kind === 'Node') {
        const r = await coreApi.readNode(name);
        obj = r.body;
      } else {
        const appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
        const r = await appsApi.readNamespacedDeployment(name, namespace);
        obj = r.body;
      }
      return { kind, name, namespace, text: JSON.stringify(obj, null, 2) };
    } catch (err) {
      return { kind, name, namespace, text: `Error describing ${kind}: ${String(err)}` };
    }
  }

  private podCountForNode(nodeName: string): number {
    let n = 0;
    for (const p of this.pods.values()) if (p.nodeName === nodeName) n++;
    return n;
  }

  private computeSummary(): ClusterSummary {
    const pods = [...this.pods.values()];
    const healthy = pods.filter(
      (p) => p.health !== 'CrashLoopBackOff' && p.health !== 'Evicted' && p.health !== 'Unknown',
    ).length;
    const cpuCap = [...this.nodes.values()].reduce((s, n) => s + n.cpu.capacityMillicores, 0);
    const cpuUsed = [...this.nodes.values()].reduce((s, n) => s + Math.max(0, n.cpu.usedMillicores), 0);
    const memCap = [...this.nodes.values()].reduce((s, n) => s + n.memory.capacityMiB, 0);
    const memUsed = [...this.nodes.values()].reduce((s, n) => s + Math.max(0, n.memory.usedMiB), 0);
    return {
      totalPods: pods.length,
      totalNodes: this.nodes.size,
      cpuPercent: cpuCap ? Math.round((cpuUsed / cpuCap) * 100) : 0,
      memoryPercent: memCap ? Math.round((memUsed / memCap) * 100) : 0,
      healthyPods: healthy,
      unhealthyPods: pods.length - healthy,
    };
  }
}

// ---------------------------------------------------------------------------
// Mappers (raw Kubernetes object → Kube Kingdom types)
// ---------------------------------------------------------------------------

/** Parse a Kubernetes CPU quantity (e.g. "100m", "0.5", "2") to millicores. */
function parseCpuToMillicores(q: string): number {
  if (!q) return 0;
  if (q.endsWith('m')) return Math.round(parseFloat(q));
  if (q.endsWith('n')) return Math.round(parseFloat(q) / 1e6); // nanocores
  if (q.endsWith('u')) return Math.round(parseFloat(q) / 1e3); // microcores
  return Math.round(parseFloat(q) * 1000);
}

/** Parse a Kubernetes memory quantity (e.g. "128Mi", "1Gi", "1000000") to MiB. */
function parseMemToMiB(q: string): number {
  if (!q) return 0;
  const m = q.match(/^([0-9.]+)\s*([A-Za-z]*)$/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2];
  const MiB = 1024 * 1024;
  const factors: Record<string, number> = {
    '': 1,
    Ki: 1024,
    Mi: MiB,
    Gi: MiB * 1024,
    Ti: MiB * 1024 * 1024,
    k: 1000,
    M: 1e6,
    G: 1e9,
    T: 1e12,
  };
  const bytes = n * (factors[unit] ?? 1);
  return Math.round(bytes / MiB);
}

function themeForNamespace(name: string): NamespaceTheme {
  if (name === 'kube-system') return 'citadel';
  if (name.startsWith('prod')) return 'production';
  if (name.startsWith('stag')) return 'staging';
  if (name.startsWith('dev')) return 'development';
  return 'default';
}

function mapPod(obj: any, prev?: Pod): Pod {
  const statuses: any[] = obj.status?.containerStatuses ?? [];
  const restartCount = statuses.reduce((s, c) => s + (c.restartCount ?? 0), 0);
  return {
    uid: obj.metadata.uid,
    name: obj.metadata.name,
    namespace: obj.metadata.namespace ?? 'default',
    nodeName: obj.spec?.nodeName ?? '',
    deploymentName: deriveOwner(obj),
    health: mapPodHealth(obj),
    cpuMillicores: prev?.cpuMillicores ?? 0,
    memoryMiB: prev?.memoryMiB ?? 0,
    restartCount,
    createdAt: obj.metadata.creationTimestamp ?? new Date().toISOString(),
    labels: obj.metadata.labels ?? {},
    containers: (obj.spec?.containers ?? []).map((c: any) => {
      const st = statuses.find((s) => s.name === c.name);
      return {
        name: c.name,
        image: c.image,
        ready: st?.ready ?? false,
        restartCount: st?.restartCount ?? 0,
      };
    }),
  };
}

function deriveOwner(obj: any): string | undefined {
  const owner = (obj.metadata?.ownerReferences ?? [])[0];
  if (!owner) return undefined;
  // ReplicaSet name → strip the trailing hash to recover the deployment name.
  if (owner.kind === 'ReplicaSet') return owner.name.replace(/-[a-z0-9]+$/, '');
  return owner.name;
}

function mapPodHealth(obj: any): PodHealth {
  const phase: string = obj.status?.phase ?? 'Unknown';
  const reason: string = obj.status?.reason ?? '';
  if (reason === 'Evicted') return 'Evicted';
  if (phase === 'Succeeded') return 'Succeeded';
  if (phase === 'Pending') return 'Pending';
  if (phase === 'Failed') return 'Evicted';
  const statuses: any[] = obj.status?.containerStatuses ?? [];
  for (const c of statuses) {
    const waiting = c.state?.waiting?.reason;
    if (waiting === 'CrashLoopBackOff') return 'CrashLoopBackOff';
    // "Restarting" must reflect the container's *current* state, not its
    // lifetime restartCount — a long-running pod can have many historical
    // restarts yet be perfectly healthy now. Flag it only when a container is
    // actively failing/churning right now.
    if (waiting === 'Error') return 'Restarting';
    const terminated = c.state?.terminated;
    if (terminated && (terminated.exitCode ?? 0) !== 0 && !c.ready) return 'Restarting';
  }
  if (phase === 'Running') return 'Running';
  return 'Unknown';
}

function mapSecret(obj: any): Secret {
  return {
    uid: obj.metadata?.uid ?? obj.metadata.uid,
    name: obj.metadata?.name ?? '',
    namespace: obj.metadata?.namespace ?? 'default',
    labels: obj.metadata?.labels ?? {},
    keys: Object.keys(obj.data ?? {}),
    type: obj.type ?? 'Opaque',
  };
}

function mapNode(obj: any, podCount: number): KubeNode {
  const conditions: any[] = obj.status?.conditions ?? [];
  const ready = conditions.find((c) => c.type === 'Ready');
  const memPressure = conditions.find((c) => c.type === 'MemoryPressure' && c.status === 'True');
  const diskPressure = conditions.find((c) => c.type === 'DiskPressure' && c.status === 'True');
  let health: NodeHealth = 'Unknown';
  if (ready?.status === 'True') {
    health = memPressure || diskPressure ? 'ResourcePressure' : 'Ready';
  } else if (ready?.status === 'False') {
    health = 'Unreachable';
  }
  const cap = obj.status?.capacity ?? {};
  return {
    name: obj.metadata.name,
    health,
    cpu: {
      capacityMillicores: parseCpuToMillicores(cap.cpu ?? "0"),
      usedMillicores: -1, // populated by metrics poll where available
    },
    memory: {
      capacityMiB: parseMemToMiB(cap.memory ?? "0"),
      usedMiB: -1,
    },
    podCount,
    labels: obj.metadata.labels ?? {},
    cordoned: obj.spec?.unschedulable === true,
  };
}
