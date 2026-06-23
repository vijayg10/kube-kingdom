import type { NamespaceTheme } from './cluster';

/**
 * City layout entities. Computed by `layout/cityLayout.ts` from ClusterState.
 * These never cross the network — they live only in the frontend (data-model.md).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DistrictLayout {
  namespace: string;
  center: Vec3;
  wallVertices: Vec3[]; // Irregular polygon defining the district boundary
  radius: number; // Approximate district radius (for camera framing / placement)
  color: string; // Hex color for minimap + district glow
  theme: NamespaceTheme;
}

export type BuildingResourceType =
  | 'pod'
  | 'node'
  | 'statefulset'
  | 'daemonset'
  | 'job'
  | 'ingress'
  | 'loadbalancer'
  | 'pv'
  | 'hpa'
  | 'configmap'
  | 'secret';

export interface BuildingLayout {
  resourceId: string; // Pod UID or node name
  resourceType: BuildingResourceType;
  position: Vec3;
  rotationY: number; // Radians — stable, derived from resourceId hash
  namespace: string;
  lodDistances: [number, number]; // [far→mid threshold, mid→close threshold]
  /** Extra metadata for extended types. */
  meta?: Record<string, unknown>;
}

export interface RoadLayout {
  serviceUid: string;
  podUids: string[]; // Tier 1: backing pod-houses this service road connects (FR-026)
  pathPoints: Vec3[]; // Cubic bezier control points
  width: number;
}

export type TerrainSurface = 'grass' | 'dirt' | 'stone' | 'water';

export interface TerrainTile {
  position: Vec3;
  surface: TerrainSurface;
  elevation: number;
}

/** A land mass in the ocean — one per namespace, plus small platforms for nodes. */
export interface IslandLayout {
  namespace: string;
  nodeId?: string;          // set only for node-platform islands
  vertices: Vec3[];         // polygon in XZ plane
  center: Vec3;
  isNodePlatform?: boolean;
}

export interface TerrainLayout {
  tiles: TerrainTile[];
  waterFeatures: Vec3[][]; // Polygons marking rivers/ponds
  islands: IslandLayout[]; // one per namespace + one per node
  bounds: { min: Vec3; max: Vec3 };
}

/** A deployment rendered as a "hamlet" — a cluster of pod-houses (SC-006). */
export interface HamletLayout {
  deploymentName: string;
  namespace: string;
  center: Vec3;
  radius: number;
}

/** A placed glTF decor prop (well, market stand, barrels, fences, …). */
export interface DecorItem {
  model: string; // model key → resolved to /models/medieval/<model>.glb
  position: Vec3;
  rotationY: number;
  scale: number;
}

/** Decorative props that make the city read as a living diorama. */
export interface PropsLayout {
  trees: Vec3[];
  lamps: Vec3[];
  decor: DecorItem[];
  groundCover: Vec3[];
}

export interface CityLayout {
  terrain: TerrainLayout;
  districts: DistrictLayout[];
  hamlets: HamletLayout[];
  buildings: BuildingLayout[];
  roads: RoadLayout[];
  props: PropsLayout;
  generatedAt: string; // ISO 8601 — regenerated only on namespace/node change
}
