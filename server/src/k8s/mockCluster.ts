import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  ActionResult,
  ClusterState,
  ClusterSummary,
  ConfigMap,
  DaemonSet,
  Deployment,
  DescribePayload,
  HPA,
  Ingress,
  JobResource,
  KubeNode,
  KubeService,
  LoadBalancer,
  LogsPayload,
  Namespace,
  NamespaceTheme,
  PersistentVolume,
  Pod,
  PodHealth,
  Secret,
  StatefulSet,
} from '../types/cluster.js';
import { emitMessage, type ClusterSource } from './clusterSource.js';

// ---------------------------------------------------------------------------
// Static topology definition
// ---------------------------------------------------------------------------

interface NamespaceSpec {
  name: string;
  deployments: Array<{ name: string; replicas: number; image: string }>;
}

const NAMESPACE_SPECS: NamespaceSpec[] = [
  {
    name: 'kube-system',
    deployments: [
      { name: 'coredns', replicas: 2, image: 'registry.k8s.io/coredns:1.11.1' },
      { name: 'kube-proxy', replicas: 3, image: 'registry.k8s.io/kube-proxy:v1.30.0' },
      { name: 'metrics-server', replicas: 1, image: 'registry.k8s.io/metrics-server:0.7.1' },
    ],
  },
  {
    name: 'production',
    deployments: [
      { name: 'api-gateway', replicas: 4, image: 'acme/api-gateway:2.3.1' },
      { name: 'payment-service', replicas: 3, image: 'acme/payment:1.9.0' },
      { name: 'transfer-service', replicas: 3, image: 'acme/transfer:1.4.2' },
    ],
  },
  {
    name: 'staging',
    deployments: [
      { name: 'api-gateway', replicas: 2, image: 'acme/api-gateway:2.4.0-rc1' },
      { name: 'web-frontend', replicas: 2, image: 'acme/web:3.0.0-beta' },
    ],
  },
  {
    name: 'development',
    deployments: [
      { name: 'experimental-svc', replicas: 2, image: 'acme/experimental:dev' },
      { name: 'web-frontend', replicas: 1, image: 'acme/web:dev' },
    ],
  },
  {
    name: 'monitoring',
    deployments: [
      { name: 'prometheus', replicas: 1, image: 'prom/prometheus:v2.53.0' },
      { name: 'grafana', replicas: 1, image: 'grafana/grafana:11.1.0' },
    ],
  },
];

const NODE_NAMES = ['node-castle-1', 'node-keep-2', 'node-watchtower-3'];

const HEALTHY_BIAS: PodHealth[] = [
  'Running',
  'Running',
  'Running',
  'Running',
  'Running',
  'Restarting',
  'Pending',
  'CrashLoopBackOff',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function themeForNamespace(name: string): NamespaceTheme {
  if (name === 'kube-system') return 'citadel';
  if (name.startsWith('prod')) return 'production';
  if (name.startsWith('stag')) return 'staging';
  if (name.startsWith('dev')) return 'development';
  return 'default';
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function isUnhealthy(h: PodHealth): boolean {
  return h === 'CrashLoopBackOff' || h === 'Evicted' || h === 'Unknown';
}

// ---------------------------------------------------------------------------
// MockCluster
// ---------------------------------------------------------------------------

export class MockCluster extends EventEmitter implements ClusterSource {
  private namespaces: Namespace[] = [];
  private nodes: KubeNode[] = [];
  private deployments: Deployment[] = [];
  private services: KubeService[] = [];
  private pods = new Map<string, Pod>();
  private ingresses: Ingress[] = [];
  private loadBalancers: LoadBalancer[] = [];
  private statefulSets: StatefulSet[] = [];
  private daemonSets: DaemonSet[] = [];
  private jobs: JobResource[] = [];
  private persistentVolumes: PersistentVolume[] = [];
  private hpas: HPA[] = [];
  private configMaps: ConfigMap[] = [];
  private secrets: Secret[] = [];
  private simTimer?: ReturnType<typeof setInterval>;
  private summaryTimer?: ReturnType<typeof setInterval>;
  private trafficTimer?: ReturnType<typeof setInterval>;

  constructor() {
    super();
    this.build();
  }

  // --- Construction ------------------------------------------------------

  private build(): void {
    this.namespaces = NAMESPACE_SPECS.map((spec) => ({
      name: spec.name,
      labels: { 'kubernetes.io/metadata.name': spec.name },
      theme: themeForNamespace(spec.name),
    }));

    this.nodes = NODE_NAMES.map((name, i) => ({
      name,
      health: 'Ready',
      cpu: { capacityMillicores: 8000, usedMillicores: randInt(1500, 5000) },
      memory: { capacityMiB: 16384, usedMiB: randInt(4000, 11000) },
      podCount: 0,
      labels: { 'node-role': i === 0 ? 'control-plane' : 'worker' },
      cordoned: false,
    }));

    for (const spec of NAMESPACE_SPECS) {
      for (const dep of spec.deployments) {
        const deployment: Deployment = {
          uid: randomUUID(),
          name: dep.name,
          namespace: spec.name,
          replicas: dep.replicas,
          readyReplicas: dep.replicas,
          labels: { app: dep.name },
        };
        this.deployments.push(deployment);

        // One service per deployment, selecting its pods by app label.
        this.services.push({
          uid: randomUUID(),
          name: `${dep.name}-svc`,
          namespace: spec.name,
          type: spec.name === 'production' && dep.name === 'api-gateway' ? 'LoadBalancer' : 'ClusterIP',
          selector: { app: dep.name },
          ports: [{ port: 80, targetPort: 8080, protocol: 'TCP' }],
        });

        for (let r = 0; r < dep.replicas; r++) {
          const pod = this.makePod(spec.name, dep, dep.image, r);
          this.pods.set(pod.uid, pod);
        }
      }
    }

    this.recomputeNodePodCounts();
    this.buildExtended();
  }

  private buildExtended(): void {
    const prodNs = 'production';
    const stagNs = 'staging';

    // Ingress: one for production, one for staging.
    this.ingresses = [
      { uid: randomUUID(), name: 'prod-ingress', namespace: prodNs, labels: {}, hosts: ['acme.example.com'], serviceUids: this.services.filter((s) => s.namespace === prodNs).map((s) => s.uid) },
      { uid: randomUUID(), name: 'stag-ingress', namespace: stagNs, labels: {}, hosts: ['staging.acme.example.com'], serviceUids: this.services.filter((s) => s.namespace === stagNs).map((s) => s.uid) },
    ];

    // LoadBalancer: surface the production api-gateway's svc.
    const lbSvc = this.services.find((s) => s.type === 'LoadBalancer');
    if (lbSvc) {
      this.loadBalancers = [
        { uid: randomUUID(), name: 'api-lb', namespace: prodNs, labels: {}, externalIP: '203.0.113.42', serviceUid: lbSvc.uid },
      ];
    }

    // StatefulSet: database in production.
    this.statefulSets = [
      { uid: randomUUID(), name: 'postgres', namespace: prodNs, labels: { app: 'postgres' }, replicas: 3, readyReplicas: 3, ordinals: [0, 1, 2] },
      { uid: randomUUID(), name: 'redis', namespace: prodNs, labels: { app: 'redis' }, replicas: 2, readyReplicas: 2, ordinals: [0, 1] },
    ];

    // DaemonSet: one per node (node exporter + fluentd).
    this.daemonSets = [
      { uid: randomUUID(), name: 'node-exporter', namespace: 'monitoring', labels: {}, desiredNumberScheduled: 3, numberReady: 3, nodeNames: [...NODE_NAMES] },
      { uid: randomUUID(), name: 'fluentd', namespace: 'kube-system', labels: {}, desiredNumberScheduled: 3, numberReady: 2, nodeNames: NODE_NAMES.slice(0, 2) },
    ];

    // Jobs / CronJobs.
    this.jobs = [
      { uid: randomUUID(), name: 'db-backup', namespace: prodNs, labels: {}, kind: 'CronJob', schedule: '0 2 * * *', state: 'Active', completions: 1 },
      { uid: randomUUID(), name: 'migration-v2', namespace: prodNs, labels: {}, kind: 'Job', state: 'Completed', completions: 1 },
      { uid: randomUUID(), name: 'report-gen', namespace: stagNs, labels: {}, kind: 'CronJob', schedule: '*/15 * * * *', state: 'Active', completions: 1 },
    ];

    // PersistentVolumes.
    this.persistentVolumes = [
      { uid: randomUUID(), name: 'postgres-pv-0', namespace: prodNs, labels: {}, capacityGiB: 50, phase: 'Bound', boundPodUids: [] },
      { uid: randomUUID(), name: 'postgres-pv-1', namespace: prodNs, labels: {}, capacityGiB: 50, phase: 'Bound', boundPodUids: [] },
      { uid: randomUUID(), name: 'backup-pv', namespace: prodNs, labels: {}, capacityGiB: 200, phase: 'Available', boundPodUids: [] },
    ];

    // HPAs: auto-scale the api-gateway and payment-service.
    this.hpas = [
      { uid: randomUUID(), name: 'api-gateway-hpa', namespace: prodNs, labels: {}, targetDeployment: 'api-gateway', minReplicas: 2, maxReplicas: 10, currentReplicas: 4 },
      { uid: randomUUID(), name: 'payment-hpa', namespace: prodNs, labels: {}, targetDeployment: 'payment-service', minReplicas: 2, maxReplicas: 6, currentReplicas: 3 },
    ];

    // ConfigMaps.
    this.configMaps = [
      { uid: randomUUID(), name: 'app-config', namespace: prodNs, labels: {}, keys: ['DATABASE_URL', 'REDIS_URL', 'LOG_LEVEL', 'MAX_POOL_SIZE'] },
      { uid: randomUUID(), name: 'nginx-config', namespace: prodNs, labels: {}, keys: ['nginx.conf'] },
      { uid: randomUUID(), name: 'prometheus-config', namespace: 'monitoring', labels: {}, keys: ['prometheus.yml', 'alerts.yml'] },
    ];

    // Secrets (keys only, never values — FR-024 analogy).
    this.secrets = [
      { uid: randomUUID(), name: 'db-credentials', namespace: prodNs, labels: {}, keys: ['username', 'password', 'connection-string'], type: 'Opaque' },
      { uid: randomUUID(), name: 'tls-cert', namespace: prodNs, labels: {}, keys: ['tls.crt', 'tls.key'], type: 'kubernetes.io/tls' },
      { uid: randomUUID(), name: 'registry-pull-secret', namespace: 'kube-system', labels: {}, keys: ['.dockerconfigjson'], type: 'kubernetes.io/dockerconfigjson' },
    ];
  }

  private makePod(namespace: string, dep: { name: string }, image: string, replica: number): Pod {
    const uid = randomUUID();
    const nodeName = pick(NODE_NAMES);
    const health: PodHealth = pick(HEALTHY_BIAS);
    const suffix = randomUUID().slice(0, 5);
    const ageMs = randInt(60_000, 14 * 24 * 60 * 60_000);
    return {
      uid,
      name: `${dep.name}-${suffix}-${replica}`,
      namespace,
      nodeName,
      deploymentName: dep.name,
      health,
      cpuMillicores: randInt(20, 800),
      memoryMiB: randInt(64, 1024),
      restartCount: health === 'CrashLoopBackOff' ? randInt(3, 40) : randInt(0, 2),
      createdAt: new Date(Date.now() - ageMs).toISOString(),
      labels: { app: dep.name, 'pod-template-hash': suffix },
      containers: [
        {
          name: dep.name,
          image,
          ready: health === 'Running',
          restartCount: health === 'CrashLoopBackOff' ? randInt(3, 40) : 0,
        },
      ],
    };
  }

  private recomputeNodePodCounts(): void {
    const counts = new Map<string, number>();
    for (const pod of this.pods.values()) {
      counts.set(pod.nodeName, (counts.get(pod.nodeName) ?? 0) + 1);
    }
    for (const node of this.nodes) {
      node.podCount = counts.get(node.name) ?? 0;
    }
  }

  // --- ClusterSource interface ------------------------------------------

  getSnapshot(): ClusterState {
    return {
      namespaces: this.namespaces,
      nodes: this.nodes,
      pods: [...this.pods.values()],
      services: this.services,
      deployments: this.deployments,
      ingresses: this.ingresses,
      loadBalancers: this.loadBalancers,
      statefulSets: this.statefulSets,
      daemonSets: this.daemonSets,
      jobs: this.jobs,
      persistentVolumes: this.persistentVolumes,
      hpas: this.hpas,
      configMaps: this.configMaps,
      secrets: this.secrets,
      summary: this.computeSummary(),
      snapshotAt: new Date().toISOString(),
    };
  }

  start(): void {
    if (this.simTimer) return;
    // Pod churn: transition a few pods every 2.5s.
    this.simTimer = setInterval(() => this.tick(), 2500);
    // Cluster summary every 5s per contract.
    this.summaryTimer = setInterval(() => {
      emitMessage(this, {
        type: 'SUMMARY_UPDATED',
        payload: this.computeSummary(),
        timestamp: Date.now(),
      });
    }, 5000);
    // Traffic events (Tier 2): a few services report load every ~1.5s, with the
    // occasional error spike that the client renders as an incident.
    this.trafficTimer = setInterval(() => this.emitTraffic(), 1500);
  }

  stop(): void {
    if (this.simTimer) clearInterval(this.simTimer);
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    if (this.trafficTimer) clearInterval(this.trafficTimer);
    this.simTimer = undefined;
    this.summaryTimer = undefined;
    this.trafficTimer = undefined;
  }

  // --- Mock action stubs (simulate success in demo mode) -----------------

  async restartPod(name: string, namespace: string): Promise<ActionResult> {
    const pod = [...this.pods.values()].find((p) => p.name === name && p.namespace === namespace);
    if (pod) { pod.health = 'Pending'; emitMessage(this, { type: 'POD_UPDATED', payload: pod, timestamp: Date.now() }); }
    return { action: 'restart', target: `${namespace}/${name}`, success: true, message: 'Pod restarted (mock)' };
  }

  async deletePod(name: string, namespace: string): Promise<ActionResult> {
    const pod = [...this.pods.values()].find((p) => p.name === name && p.namespace === namespace);
    if (pod) { this.pods.delete(pod.uid); emitMessage(this, { type: 'POD_DELETED', payload: { uid: pod.uid, namespace }, timestamp: Date.now() }); }
    return { action: 'delete', target: `${namespace}/${name}`, success: true, message: 'Pod deleted (mock)' };
  }

  async scaleDeployment(name: string, namespace: string, replicas: number): Promise<ActionResult> {
    const dep = this.deployments.find((d) => d.name === name && d.namespace === namespace);
    if (dep) { dep.replicas = replicas; emitMessage(this, { type: 'DEPLOYMENT_UPDATED', payload: dep, timestamp: Date.now() }); }
    return { action: 'scale', target: `${namespace}/${name}`, success: true, message: `Scaled to ${replicas} (mock)` };
  }

  async cordonNode(name: string, cordon: boolean): Promise<ActionResult> {
    const node = this.nodes.find((n) => n.name === name);
    if (node) { node.cordoned = cordon; emitMessage(this, { type: 'NODE_UPDATED', payload: node, timestamp: Date.now() }); }
    return { action: cordon ? 'cordon' : 'uncordon', target: name, success: true, message: `Node ${cordon ? 'cordoned' : 'uncordoned'} (mock)` };
  }

  async getLogs(name: string, namespace: string): Promise<LogsPayload> {
    const lines = [
      `[mock] ${new Date().toISOString()} Starting container...`,
      `[mock] Listening on :8080`,
      `[mock] GET /healthz 200 2ms`,
      `[mock] Processed 42 requests`,
    ];
    return { podName: name, namespace, lines };
  }

  async describeResource(kind: string, name: string, namespace: string): Promise<DescribePayload> {
    const pod = kind === 'Pod' ? [...this.pods.values()].find((p) => p.name === name) : undefined;
    const text = pod
      ? JSON.stringify(pod, null, 2)
      : `(mock) ${kind} ${namespace}/${name} — connect to a live cluster for real describe output`;
    return { kind, name, namespace, text };
  }

  private emitTraffic(): void {
    if (this.services.length === 0) return;
    const n = randInt(2, Math.min(5, this.services.length));
    for (let i = 0; i < n; i++) {
      const svc = pick(this.services);
      // Most traffic is healthy; ~12% of events spike error rate / latency.
      const incident = Math.random() < 0.12;
      emitMessage(this, {
        type: 'TRAFFIC_EVENT',
        payload: {
          serviceUid: svc.uid,
          requestsPerSecond: randInt(5, 200),
          errorRate: incident ? 0.3 + Math.random() * 0.6 : Math.random() * 0.05,
          latencyMs: incident ? randInt(400, 2000) : randInt(8, 180),
        },
        timestamp: Date.now(),
      });
    }
  }

  // --- Simulation --------------------------------------------------------

  private tick(): void {
    const pods = [...this.pods.values()];
    const churnCount = randInt(2, 5);
    for (let i = 0; i < churnCount; i++) {
      const pod = pick(pods);
      this.advancePod(pod);
      emitMessage(this, { type: 'POD_UPDATED', payload: pod, timestamp: Date.now() });
    }

    // Occasionally toggle a node into/out of resource pressure.
    if (Math.random() < 0.15) {
      const node = pick(this.nodes);
      node.health = node.health === 'Ready' ? 'ResourcePressure' : 'Ready';
      node.cpu.usedMillicores = randInt(1500, 7500);
      node.memory.usedMiB = randInt(4000, 15000);
      emitMessage(this, { type: 'NODE_UPDATED', payload: node, timestamp: Date.now() });
    }
  }

  /** Drive one pod through the health state machine (data-model.md). */
  private advancePod(pod: Pod): void {
    const r = Math.random();
    switch (pod.health) {
      case 'Pending':
        pod.health = 'Running';
        pod.containers[0].ready = true;
        break;
      case 'Running':
        if (r < 0.08) pod.health = 'Restarting';
        else if (r < 0.1) pod.health = 'CrashLoopBackOff';
        break;
      case 'Restarting':
        if (r < 0.6) {
          pod.health = 'Running';
          pod.containers[0].ready = true;
        } else {
          pod.health = 'CrashLoopBackOff';
          pod.restartCount += 1;
          pod.containers[0].restartCount += 1;
        }
        break;
      case 'CrashLoopBackOff':
        if (r < 0.4) {
          pod.health = 'Restarting';
        } else {
          pod.restartCount += 1;
          pod.containers[0].restartCount += 1;
        }
        break;
      case 'Evicted':
      case 'Succeeded':
      case 'Unknown':
        if (r < 0.5) pod.health = 'Pending';
        break;
    }
    // Jitter live metrics so the HUD feels alive.
    pod.cpuMillicores = Math.max(5, pod.cpuMillicores + randInt(-60, 60));
    pod.memoryMiB = Math.max(16, pod.memoryMiB + randInt(-40, 40));
    pod.containers[0].ready = pod.health === 'Running';
  }

  private computeSummary(): ClusterSummary {
    const pods = [...this.pods.values()];
    let healthy = 0;
    for (const p of pods) if (!isUnhealthy(p.health)) healthy++;

    const cpuCap = this.nodes.reduce((s, n) => s + n.cpu.capacityMillicores, 0);
    const cpuUsed = this.nodes.reduce((s, n) => s + n.cpu.usedMillicores, 0);
    const memCap = this.nodes.reduce((s, n) => s + n.memory.capacityMiB, 0);
    const memUsed = this.nodes.reduce((s, n) => s + n.memory.usedMiB, 0);

    return {
      totalPods: pods.length,
      totalNodes: this.nodes.length,
      cpuPercent: cpuCap ? Math.round((cpuUsed / cpuCap) * 100) : 0,
      memoryPercent: memCap ? Math.round((memUsed / memCap) * 100) : 0,
      healthyPods: healthy,
      unhealthyPods: pods.length - healthy,
    };
  }
}
