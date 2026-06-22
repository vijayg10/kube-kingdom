import * as THREE from 'three';
import type { TrafficEvent } from '../../../types/cluster';

/** 4 latency tiers + failure (FR-017). */
export type LatencyState = 'normal' | 'elevated' | 'high' | 'critical' | 'failed';

export function latencyState(event: TrafficEvent | undefined): LatencyState {
  if (!event) return 'normal';
  if (event.errorRate > 0.2) return 'failed';
  if (event.latencyMs > 800) return 'critical';
  if (event.latencyMs > 300) return 'high';
  if (event.latencyMs > 120) return 'elevated';
  return 'normal';
}

/** Whether a service is in an incident (cascade trigger, FR-018). */
export function isIncident(event: TrafficEvent | undefined): boolean {
  return !!event && event.errorRate > 0.25;
}

export const STATE_COLOR: Record<LatencyState, THREE.Color> = {
  normal: new THREE.Color('#7fd36a'),
  elevated: new THREE.Color('#e0d24a'),
  high: new THREE.Color('#e08a2a'),
  critical: new THREE.Color('#d8472f'),
  failed: new THREE.Color('#ff2a18'),
};

/** Cart speed (curve fraction per second) by latency state. */
export const STATE_SPEED: Record<LatencyState, number> = {
  normal: 0.32,
  elevated: 0.2,
  high: 0.12,
  critical: 0.05,
  failed: 0,
};
