import { EventEmitter } from 'node:events';
import type { ClusterState, ServerMessage, ActionResult, LogsPayload, DescribePayload } from '../types/cluster.js';

/**
 * Common interface for anything that produces cluster state + live deltas.
 * Implemented by {@link MockCluster} (synthetic) and the real Kubernetes
 * watcher. The broadcaster consumes a `ClusterSource` without caring which.
 *
 * Emits a single `'message'` event carrying a {@link ServerMessage} for every
 * delta (POD_UPDATED, SUMMARY_UPDATED, etc.). The initial CLUSTER_SNAPSHOT is
 * sent by the broadcaster on connect using {@link getSnapshot}.
 */
export interface ClusterSource extends EventEmitter {
  /** Current full cluster state (sent on client connect). */
  getSnapshot(): ClusterState;
  /** Begin producing live updates. */
  start(): void;
  /** Stop and release resources. */
  stop(): void;
  /** Optional mutation actions (only meaningful when readOnly=false). */
  restartPod?(name: string, namespace: string): Promise<ActionResult>;
  deletePod?(name: string, namespace: string): Promise<ActionResult>;
  scaleDeployment?(name: string, namespace: string, replicas: number): Promise<ActionResult>;
  cordonNode?(name: string, cordon: boolean): Promise<ActionResult>;
  getLogs?(name: string, namespace: string, container?: string): Promise<LogsPayload>;
  describeResource?(kind: string, name: string, namespace: string): Promise<DescribePayload>;
}

/** Typed helper for emitting source messages. */
export function emitMessage(source: EventEmitter, msg: ServerMessage): void {
  source.emit('message', msg);
}
