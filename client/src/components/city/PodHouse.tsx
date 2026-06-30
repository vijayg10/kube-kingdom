import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { BuildingLayout } from '../../types/layout';
import { useClusterStore } from '../../store/clusterStore';
import { useUiStore } from '../../store/uiStore';
import { useLOD } from '../../hooks/useLOD';
import { POD_HEALTH_COLOR } from './health';
import { modelManifest } from '../../render/modelManifest';
import { GltfModel } from './models/GltfModel';
import { ModelOrFallback } from './models/ModelOrFallback';
import { hashString } from '../../layout/seededRandom';

// Cap on model-rendered houses (cloned, not instanced). Beyond this, procedural
// instancing keeps the frame rate up (the perf pass T067 can instance the GLB).
const MODEL_HOUSE_CAP = 400;

// House variety: cottages cycle through the pack's house models (stable per UID).
const HOUSE_VARIANTS = [
  '/models/medieval/House_1.glb',
  '/models/medieval/House_2.glb',
  '/models/medieval/House_3.glb',
  '/models/medieval/House_4.glb',
];

function selectPod(uid: string) {
  useUiStore.getState().select({ kind: 'pod', id: uid });
}

/**
 * Pod houses as two InstancedMeshes sharing transforms: neutral plaster walls
 * (with a door) + a health-colored roof. One draw call each for all pods
 * (research.md §2). Roof color is driven every frame straight from
 * clusterStore.pods via setColorAt, bypassing React. Hidden at far LOD.
 */

const W = 2.2; // house footprint
const WALL_H = 1.8;
const ROOF_H = 1.3;

function buildWallsGeometry(): THREE.BufferGeometry {
  // Single BoxGeometry — no mergeGeometries (which produces raw BufferGeometry
  // that corrupts N8AO's depth pre-pass on fresh page load).
  const walls = new THREE.BoxGeometry(W, WALL_H, W);
  walls.translate(0, WALL_H / 2, 0);
  return walls;
}

function buildRoofGeometry(): THREE.BufferGeometry {
  const roof = new THREE.ConeGeometry(W * 0.86, ROOF_H, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, WALL_H + ROOF_H / 2, 0);
  roof.computeVertexNormals();
  return roof;
}

const _dummy = new THREE.Object3D();
const _scratch = new THREE.Color();

function ProceduralPodHouses({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const wallsRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const wallsGeom = useMemo(buildWallsGeometry, []);
  const roofGeom = useMemo(buildRoofGeometry, []);

  const pods = useMemo(() => buildings.filter((b) => b.resourceType === 'pod'), [buildings]);

  // Place both instanced meshes once per layout change (stable positions).
  useEffect(() => {
    const walls = wallsRef.current;
    const roof = roofRef.current;
    if (!walls || !roof) return;
    const podMap = useClusterStore.getState().pods;
    pods.forEach((b, i) => {
      _dummy.position.set(b.position.x, b.position.y, b.position.z);
      _dummy.rotation.set(0, b.rotationY, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      walls.setMatrixAt(i, _dummy.matrix);
      roof.setMatrixAt(i, _dummy.matrix);
      const pod = podMap.get(b.resourceId);
      roof.setColorAt(i, pod ? POD_HEALTH_COLOR[pod.health] : POD_HEALTH_COLOR.Unknown);
    });
    walls.count = pods.length;
    roof.count = pods.length;
    walls.instanceMatrix.needsUpdate = true;
    roof.instanceMatrix.needsUpdate = true;
    if (roof.instanceColor) roof.instanceColor.needsUpdate = true;
    walls.computeBoundingSphere();
    roof.computeBoundingSphere();
  }, [pods]);

  // Drive roof health color every frame from the store.
  useFrame(() => {
    const roof = roofRef.current;
    if (!roof || !roof.instanceColor || lod === 'far') return;
    const podMap = useClusterStore.getState().pods;
    let dirty = false;
    for (let i = 0; i < pods.length; i++) {
      const pod = podMap.get(pods[i].resourceId);
      const color = pod ? POD_HEALTH_COLOR[pod.health] : POD_HEALTH_COLOR.Unknown;
      roof.getColorAt(i, _scratch);
      if (!_scratch.equals(color)) {
        roof.setColorAt(i, color);
        dirty = true;
      }
    }
    if (dirty) roof.instanceColor.needsUpdate = true;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    const uid = pods[e.instanceId]?.resourceId;
    if (uid) useUiStore.getState().select({ kind: 'pod', id: uid });
  };

  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId == null) return;
    e.stopPropagation();
    (e.nativeEvent as MouseEvent).preventDefault();
    const uid = pods[e.instanceId]?.resourceId;
    if (!uid) return;
    useUiStore.getState().openContextMenu({
      x: (e.nativeEvent as MouseEvent).clientX,
      y: (e.nativeEvent as MouseEvent).clientY,
      target: { kind: 'pod', id: uid },
    });
  };

  if (lod === 'far' || pods.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={wallsRef}
        args={[wallsGeom, undefined, pods.length]}
        castShadow
        receiveShadow
        frustumCulled
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <meshStandardMaterial color="#e8ddc7" roughness={0.9} metalness={0} />
      </instancedMesh>
      <instancedMesh
        ref={roofRef}
        args={[roofGeom, undefined, pods.length]}
        castShadow
        receiveShadow
        frustumCulled
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.8} metalness={0} />
      </instancedMesh>
    </group>
  );
}

/**
 * Pod houses rendered from the real glTF model (cloned per pod, capped). Health
 * is conveyed by the ground HealthGlow + fire/smoke effects (PodEffects) rather
 * than roof tint, since the model's materials aren't per-instance.
 */
function ModelPodHouses({ buildings }: { buildings: BuildingLayout[] }) {
  const entry = modelManifest.house!;
  const pods = useMemo(
    () => buildings.filter((b) => b.resourceType === 'pod').slice(0, MODEL_HOUSE_CAP),
    [buildings],
  );
  return (
    <>
      {pods.map((b) => (
        <group
          key={b.resourceId}
          position={[b.position.x, b.position.y, b.position.z]}
          rotation={[0, b.rotationY, 0]}
          onClick={(e) => {
            e.stopPropagation();
            selectPod(b.resourceId);
          }}
          onContextMenu={(e) => {
            e.stopPropagation();
            (e.nativeEvent as MouseEvent).preventDefault();
            useUiStore.getState().openContextMenu({
              x: (e.nativeEvent as MouseEvent).clientX,
              y: (e.nativeEvent as MouseEvent).clientY,
              target: { kind: 'pod', id: b.resourceId },
            });
          }}
        >
          <GltfModel
            url={HOUSE_VARIANTS[hashString(b.resourceId) % HOUSE_VARIANTS.length]}
            scale={entry.scale}
            rotationY={entry.rotationY ?? 0}
            position={{ x: 0, y: entry.yOffset ?? 0, z: 0 }}
            groundAlign
          />
        </group>
      ))}
    </>
  );
}

/** Picks the real-model renderer when assets are enabled, else procedural. */
export function PodHouse({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  if (lod === 'far') return null;
  if (modelManifest.enabled && modelManifest.house) {
    return (
      <ModelOrFallback fallback={<ProceduralPodHouses buildings={buildings} />}>
        <ModelPodHouses buildings={buildings} />
      </ModelOrFallback>
    );
  }
  return <ProceduralPodHouses buildings={buildings} />;
}

export default PodHouse;
