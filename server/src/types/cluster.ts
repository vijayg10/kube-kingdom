/**
 * Shared cluster + transport types for Kube Kingdom.
 *
 * ⚠️ MIRRORED FILE: this file is kept byte-for-byte identical to
 * `client/src/types/cluster.ts`. When you change one, change the other.
 * See plan.md "Structure Decision".
 */

// ---------------------------------------------------------------------------
// Health enums
// ---------------------------------------------------------------------------

export type PodHealth =
  | 'Running' // Green — healthy, active
  | 'Pending' // Gray — under construction
  | 'Restarting' // Amber — flashing lantern
  | 'CrashLoopBackOff' // Red — fire + smoke
  | 'Evicted' // Dark — ruined structure
  | 'Succeeded' // Faded green — job completed
  | 'Unknown'; // Gray — no data

export type NodeHealth =
  | 'Ready' // Fully lit, banners flying
  | 'ResourcePressure' // Orange glow, congested roads
  | 'Unreachable' // Dark building, red beacon
  | 'Unknown';

// ---------------------------------------------------------------------------
// Core cluster entities
// ---------------------------------------------------------------------------

export interface Container {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
}

export interface Pod {
  uid: string; // Kubernetes UID — stable city house ID
  name: string;
  namespace: string;
  nodeName: string;
  deploymentName?: string; // Which deployment/hamlet this house belongs to
  health: PodHealth;
  cpuMillicores: number; // Current CPU usage
  memoryMiB: number; // Current memory usage
  restartCount: number;
  createdAt: string; // ISO 8601
  labels: Record<string, string>;
  containers: Container[];
}

export interface KubeNode {
  name: string; // Stable node name — city landmark ID
  health: NodeHealth;
  cpu: {
    capacityMillicores: number;
    usedMillicores: number;
  };
  memory: {
    capacityMiB: number;
    usedMiB: number;
  };
  podCount: number;
  labels: Record<string, string>;
  cordoned: boolean;
}

export type NamespaceTheme =
  | 'citadel' // kube-system — central castle
  | 'production' // Grand stone buildings
  | 'staging' // Modest timber buildings
  | 'development' // Construction zones
  | 'default'; // Generic district

export interface Namespace {
  name: string;
  labels: Record<string, string>;
  theme: NamespaceTheme; // Derived from name
}

export interface KubeService {
  uid: string;
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector: Record<string, string>;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
}

export interface Deployment {
  uid: string;
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  labels: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Tier-2 extended resource entities (US6, FR-023)
// ---------------------------------------------------------------------------

export interface ResourceBase {
  uid: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
}

export interface Ingress extends ResourceBase {
  // → City Gate
  hosts: string[];
  serviceUids: string[];
}

export interface LoadBalancer extends ResourceBase {
  // → Crossroads / Interchange
  externalIP?: string;
  serviceUid: string;
}

export interface StatefulSet extends ResourceBase {
  // → Row of numbered townhouses
  replicas: number;
  readyReplicas: number;
  ordinals: number[];
}

export interface DaemonSet extends ResourceBase {
  // → Watchtower (one per node)
  desiredNumberScheduled: number;
  numberReady: number;
  nodeNames: string[];
}

export interface JobResource extends ResourceBase {
  // → Traveling merchant
  kind: 'Job' | 'CronJob';
  schedule?: string; // Cron expression (CronJob only)
  state: 'Active' | 'Completed' | 'Failed';
  completions: number;
}

export interface PersistentVolume extends ResourceBase {
  // → Warehouse / Storage barn
  capacityGiB: number;
  phase: 'Bound' | 'Available' | 'Released' | 'Failed';
  boundPodUids: string[];
}

export interface HPA extends ResourceBase {
  // → Construction foreman
  targetDeployment: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
}

export interface ConfigMap extends ResourceBase {
  // → Wells / signposts
  keys: string[];
}

export interface Secret extends ResourceBase {
  // → Fortified vault
  keys: string[]; // Names only — values never sent
  type: string;
}

// ---------------------------------------------------------------------------
// Summary + full snapshot
// ---------------------------------------------------------------------------

export interface ClusterSummary {
  totalPods: number;
  totalNodes: number;
  cpuPercent: number; // Cluster-wide average CPU utilization 0–100
  memoryPercent: number; // Cluster-wide average memory utilization 0–100
  healthyPods: number;
  unhealthyPods: number;
}

export interface ClusterState {
  namespaces: Namespace[];
  nodes: KubeNode[];
  pods: Pod[];
  services: KubeService[];
  deployments: Deployment[];
  // Tier-2 extended resources (US6) — empty until those emitters land:
  ingresses: Ingress[];
  loadBalancers: LoadBalancer[];
  statefulSets: StatefulSet[];
  daemonSets: DaemonSet[];
  jobs: JobResource[];
  persistentVolumes: PersistentVolume[];
  hpas: HPA[];
  configMaps: ConfigMap[];
  secrets: Secret[];
  summary: ClusterSummary;
  snapshotAt: string; // ISO 8601 — when snapshot was taken
}

// ---------------------------------------------------------------------------
// Traffic & event entities (Tier 2)
// ---------------------------------------------------------------------------

export interface TrafficUnit {
  id: string;
  fromServiceUid: string;
  toServiceUid: string;
  type: 'cart' | 'horse' | 'messenger';
  status: 'normal' | 'elevated' | 'high' | 'critical' | 'failed';
  progressT: number; // 0.0–1.0 along road path
  startedAt: number; // performance.now() timestamp
}

export interface TrafficEvent {
  serviceUid: string;
  requestsPerSecond: number;
  errorRate: number; // 0.0–1.0
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// WebSocket protocol (contracts/websocket-protocol.md)
// ---------------------------------------------------------------------------

/** Generic envelope for every message in both directions. */
export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number; // Unix ms (Date.now())
}

export type ErrorCode =
  | 'KUBECONFIG_INVALID'
  | 'CLUSTER_UNREACHABLE'
  | 'WATCH_FAILED'
  | 'WATCH_RECONNECTING'
  | 'ACTION_DENIED';

export interface WsErrorPayload {
  code: ErrorCode;
  message: string;
}

export interface ServerConfig {
  readOnly: boolean;
  mockMode: boolean;
}

export interface ActionResult {
  action: string;
  target: string;
  success: boolean;
  message: string;
}

export interface LogsPayload {
  podName: string;
  namespace: string;
  lines: string[];
}

export interface DescribePayload {
  kind: string;
  name: string;
  namespace: string;
  text: string;
}

// --- Server → Client messages ---
export type ServerMessage =
  | WsMessage<ClusterState> & { type: 'CLUSTER_SNAPSHOT' }
  | (WsMessage<Pod> & { type: 'POD_UPDATED' })
  | (WsMessage<{ uid: string; namespace: string }> & { type: 'POD_DELETED' })
  | (WsMessage<KubeNode> & { type: 'NODE_UPDATED' })
  | (WsMessage<Namespace> & { type: 'NAMESPACE_UPDATED' })
  | (WsMessage<{ name: string }> & { type: 'NAMESPACE_DELETED' })
  | (WsMessage<KubeService> & { type: 'SERVICE_UPDATED' })
  | (WsMessage<Deployment> & { type: 'DEPLOYMENT_UPDATED' })
  | (WsMessage<ClusterSummary> & { type: 'SUMMARY_UPDATED' })
  | (WsMessage<TrafficEvent> & { type: 'TRAFFIC_EVENT' })
  | (WsMessage<ServerConfig> & { type: 'SERVER_CONFIG' })
  | (WsMessage<ActionResult> & { type: 'ACTION_RESULT' })
  | (WsMessage<LogsPayload> & { type: 'LOGS_RESULT' })
  | (WsMessage<DescribePayload> & { type: 'DESCRIBE_RESULT' })
  | (WsMessage<WsErrorPayload> & { type: 'ERROR' });

// --- Client → Server messages ---
export type ClientMessage =
  | (WsMessage<null> & { type: 'CONNECT_MOCK' })
  | (WsMessage<{ context: string }> & { type: 'CONNECT_CLUSTER' })
  | (WsMessage<{ name: string; namespace: string }> & { type: 'ACTION_RESTART_POD' })
  | (WsMessage<{ name: string; namespace: string }> & { type: 'ACTION_DELETE_POD' })
  | (WsMessage<{ name: string; namespace: string; replicas: number }> & {
      type: 'ACTION_SCALE_DEPLOYMENT';
    })
  | (WsMessage<{ name: string; cordon: boolean }> & { type: 'ACTION_CORDON_NODE' })
  | (WsMessage<{ name: string; namespace: string; container?: string }> & {
      type: 'ACTION_VIEW_LOGS';
    })
  | (WsMessage<{ kind: string; name: string; namespace: string }> & {
      type: 'ACTION_DESCRIBE';
    });

export type ServerMessageType = ServerMessage['type'];
export type ClientMessageType = ClientMessage['type'];
