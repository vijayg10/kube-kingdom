import { create } from 'zustand';
import type {
  ClusterState,
  ClusterSummary,
  ConfigMap,
  DaemonSet,
  Deployment,
  HPA,
  Ingress,
  JobResource,
  KubeNode,
  KubeService,
  LoadBalancer,
  Namespace,
  PersistentVolume,
  Pod,
  Secret,
  StatefulSet,
  TrafficEvent,
} from '../types/cluster';

/**
 * Live cluster resource state, keyed by stable IDs for O(1) upsert/delete.
 *
 * Performance note (research.md §4): pod health is read directly from
 * `pods` inside `useFrame` to drive `InstancedMesh.setColorAt` — the
 * instanced renderer does NOT subscribe to React re-renders per pod.
 */
interface ClusterStore {
  pods: Map<string, Pod>; // keyed by uid
  nodes: Map<string, KubeNode>; // keyed by name
  namespaces: Map<string, Namespace>; // keyed by name
  services: Map<string, KubeService>; // keyed by uid
  deployments: Map<string, Deployment>; // keyed by uid
  // Extended resources (US6) — stored as arrays, snapshot-only for now:
  ingresses: Ingress[];
  loadBalancers: LoadBalancer[];
  statefulSets: StatefulSet[];
  daemonSets: DaemonSet[];
  jobs: JobResource[];
  persistentVolumes: PersistentVolume[];
  hpas: HPA[];
  configMaps: ConfigMap[];
  secrets: Secret[];
  summary: ClusterSummary | null;
  snapshotAt: string | null;
  /** Latest traffic event per service (Tier 2, US4). */
  traffic: Map<string, TrafficEvent>;
  /** Bumped whenever the namespace/node set changes, so layout can regenerate. */
  topologyVersion: number;

  applySnapshot: (state: ClusterState) => void;
  upsertPod: (pod: Pod) => void;
  deletePod: (uid: string) => void;
  upsertNode: (node: KubeNode) => void;
  upsertNamespace: (ns: Namespace) => void;
  deleteNamespace: (name: string) => void;
  upsertService: (svc: KubeService) => void;
  upsertDeployment: (dep: Deployment) => void;
  setSummary: (summary: ClusterSummary) => void;
  setTraffic: (event: TrafficEvent) => void;
  reset: () => void;
}

const empty = () => ({
  pods: new Map<string, Pod>(),
  nodes: new Map<string, KubeNode>(),
  namespaces: new Map<string, Namespace>(),
  services: new Map<string, KubeService>(),
  deployments: new Map<string, Deployment>(),
  ingresses: [] as Ingress[],
  loadBalancers: [] as LoadBalancer[],
  statefulSets: [] as StatefulSet[],
  daemonSets: [] as DaemonSet[],
  jobs: [] as JobResource[],
  persistentVolumes: [] as PersistentVolume[],
  hpas: [] as HPA[],
  configMaps: [] as ConfigMap[],
  secrets: [] as Secret[],
  summary: null,
  snapshotAt: null,
  traffic: new Map<string, TrafficEvent>(),
});

export const useClusterStore = create<ClusterStore>((set, get) => ({
  ...empty(),
  topologyVersion: 0,

  applySnapshot: (state) =>
    set((s) => ({
      pods: new Map(state.pods.map((p) => [p.uid, p])),
      nodes: new Map(state.nodes.map((n) => [n.name, n])),
      namespaces: new Map(state.namespaces.map((n) => [n.name, n])),
      services: new Map(state.services.map((sv) => [sv.uid, sv])),
      deployments: new Map(state.deployments.map((d) => [d.uid, d])),
      ingresses: state.ingresses,
      loadBalancers: state.loadBalancers,
      statefulSets: state.statefulSets,
      daemonSets: state.daemonSets,
      jobs: state.jobs,
      persistentVolumes: state.persistentVolumes,
      hpas: state.hpas,
      configMaps: state.configMaps,
      secrets: state.secrets,
      summary: state.summary,
      snapshotAt: state.snapshotAt,
      topologyVersion: s.topologyVersion + 1,
    })),

  upsertPod: (pod) =>
    set((s) => {
      const isNew = !s.pods.has(pod.uid);
      const pods = new Map(s.pods);
      pods.set(pod.uid, pod);
      // Only a membership change moves buildings → regenerate layout.
      // Health-only updates keep topologyVersion stable (handled in useFrame).
      return { pods, topologyVersion: isNew ? s.topologyVersion + 1 : s.topologyVersion };
    }),

  deletePod: (uid) =>
    set((s) => {
      if (!s.pods.has(uid)) return s;
      const pods = new Map(s.pods);
      pods.delete(uid);
      return { pods, topologyVersion: s.topologyVersion + 1 };
    }),

  upsertNode: (node) =>
    set((s) => {
      const isNew = !s.nodes.has(node.name);
      const nodes = new Map(s.nodes);
      nodes.set(node.name, node);
      return { nodes, topologyVersion: isNew ? s.topologyVersion + 1 : s.topologyVersion };
    }),

  upsertNamespace: (ns) =>
    set((s) => {
      const namespaces = new Map(s.namespaces);
      const isNew = !namespaces.has(ns.name);
      namespaces.set(ns.name, ns);
      return { namespaces, topologyVersion: isNew ? s.topologyVersion + 1 : s.topologyVersion };
    }),

  deleteNamespace: (name) =>
    set((s) => {
      if (!s.namespaces.has(name)) return s;
      const namespaces = new Map(s.namespaces);
      namespaces.delete(name);
      // Drop pods in the removed namespace too.
      const pods = new Map([...s.pods].filter(([, p]) => p.namespace !== name));
      return { namespaces, pods, topologyVersion: s.topologyVersion + 1 };
    }),

  upsertService: (svc) =>
    set((s) => {
      const services = new Map(s.services);
      services.set(svc.uid, svc);
      return { services };
    }),

  upsertDeployment: (dep) =>
    set((s) => {
      const deployments = new Map(s.deployments);
      deployments.set(dep.uid, dep);
      return { deployments };
    }),

  setSummary: (summary) => set({ summary }),

  // Mutated in place — Traffic/Incident read it inside useFrame, so we avoid a
  // store-wide re-render on every traffic tick.
  setTraffic: (event) => {
    get().traffic.set(event.serviceUid, event);
  },

  reset: () => set((s) => ({ ...empty(), topologyVersion: s.topologyVersion + 1 })),
}));
