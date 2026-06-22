import * as THREE from 'three';
import type { NodeHealth, PodHealth } from '../../types/cluster';

/**
 * Health → color mapping (constitution Principle IV, PROMPT health tables).
 * Colors are pre-instantiated THREE.Color objects so hot paths (InstancedMesh
 * setColorAt in useFrame) never allocate.
 */

export const POD_HEALTH_COLOR: Record<PodHealth, THREE.Color> = {
  Running: new THREE.Color('#5fae4c'), // green — healthy
  Pending: new THREE.Color('#9aa6ad'), // gray-blue — under construction
  Restarting: new THREE.Color('#e0a53a'), // amber — flashing lantern
  CrashLoopBackOff: new THREE.Color('#c8412f'), // red — fire + smoke
  Evicted: new THREE.Color('#4a3f3a'), // dark — ruin
  Succeeded: new THREE.Color('#8fbf86'), // faded green — done
  Unknown: new THREE.Color('#8a8a8a'), // gray — no data
};

export const NODE_HEALTH_COLOR: Record<NodeHealth, THREE.Color> = {
  Ready: new THREE.Color('#d9c69a'), // warm lit stone
  ResourcePressure: new THREE.Color('#d97a2a'), // orange glow
  Unreachable: new THREE.Color('#3a3a42'), // dark
  Unknown: new THREE.Color('#7a7a7a'),
};

export function isPodUnhealthy(h: PodHealth): boolean {
  return h === 'CrashLoopBackOff' || h === 'Evicted';
}
