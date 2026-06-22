import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { BuildingLayout } from '../../types/layout';
import type { NodeHealth } from '../../types/cluster';
import { useClusterStore } from '../../store/clusterStore';
import { useUiStore } from '../../store/uiStore';
import { useLOD } from '../../hooks/useLOD';
import { NODE_HEALTH_COLOR } from './health';
import { modelManifest } from '../../render/modelManifest';
import { GltfModel } from './models/GltfModel';
import { ModelOrFallback } from './models/ModelOrFallback';

/**
 * Node landmarks — a castle/keep per Kubernetes node (PROMPT: nodes are large
 * landmark buildings). There are few nodes, so each is its own mesh group
 * rather than instanced. Stone tint reflects node health (T044 layers banners /
 * beacons / cordon barriers on top).
 */

/** Pulsing red emergency beacon for Unreachable nodes (PROMPT node table). */
function Beacon() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff2a1a',
        emissive: new THREE.Color('#ff2a1a'),
        emissiveIntensity: 3,
        toneMapped: false,
      }),
    [],
  );
  useFrame((s) => {
    if (ref.current) {
      const p = 0.6 + Math.sin(s.clock.elapsedTime * 6) * 0.4;
      (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = p * 4;
    }
  });
  return (
    <mesh ref={ref} position={[0, 8.6, 0]} material={mat}>
      <sphereGeometry args={[0.5, 12, 12]} />
    </mesh>
  );
}

/** Banner flags flying from the towers when the node is Ready. */
function Banners() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b23a2e', roughness: 0.7, side: THREE.DoubleSide }), []);
  const towerPositions: [number, number][] = [
    [-2.2, -2.2],
    [2.2, -2.2],
    [-2.2, 2.2],
    [2.2, 2.2],
  ];
  return (
    <>
      {towerPositions.map(([x, z], i) => (
        <group key={i} position={[x, 8.3, z]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.6, 6]} />
            <meshStandardMaterial color="#3a2a18" />
          </mesh>
          <mesh position={[0.45, 0.4, 0]} material={mat}>
            <planeGeometry args={[0.9, 0.5]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function CastleKeep({ tint }: { tint: THREE.Color }) {
  // Memoize a slightly weathered stone material tinted by health.
  const stone = useMemo(
    () => new THREE.MeshStandardMaterial({ color: tint.clone(), roughness: 0.92, metalness: 0.02 }),
    [tint],
  );
  const roof = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#6e3b2e', roughness: 0.8 }),
    [],
  );

  const towerPositions: [number, number][] = [
    [-2.2, -2.2],
    [2.2, -2.2],
    [-2.2, 2.2],
    [2.2, 2.2],
  ];

  return (
    <group>
      {/* Central keep */}
      <mesh castShadow receiveShadow position={[0, 2.6, 0]} material={stone}>
        <boxGeometry args={[4, 5.2, 4]} />
      </mesh>
      {/* Battlement cap */}
      <mesh castShadow position={[0, 5.4, 0]} material={stone}>
        <boxGeometry args={[4.5, 0.5, 4.5]} />
      </mesh>
      {/* Corner towers */}
      {towerPositions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 3.4, 0]} material={stone}>
            <cylinderGeometry args={[1, 1.1, 6.8, 10]} />
          </mesh>
          <mesh castShadow position={[0, 7.4, 0]} material={roof}>
            <coneGeometry args={[1.3, 1.8, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function NodeLandmark({ layout }: { layout: BuildingLayout }) {
  const health: NodeHealth = useClusterStore(
    (s) => s.nodes.get(layout.resourceId)?.health ?? 'Unknown',
  );
  const tint = NODE_HEALTH_COLOR[health];
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    useUiStore.getState().select({ kind: 'node', id: layout.resourceId });
  };
  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    (e.nativeEvent as MouseEvent).preventDefault();
    useUiStore.getState().openContextMenu({
      x: (e.nativeEvent as MouseEvent).clientX,
      y: (e.nativeEvent as MouseEvent).clientY,
      target: { kind: 'node', id: layout.resourceId },
    });
  };
  return (
    <group
      position={[layout.position.x, layout.position.y, layout.position.z]}
      rotation={[0, layout.rotationY, 0]}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {modelManifest.enabled && modelManifest.node ? (
        <ModelOrFallback fallback={<CastleKeep tint={tint} />}>
          <GltfModel
            url={modelManifest.node.url}
            scale={modelManifest.node.scale}
            position={{ x: 0, y: modelManifest.node.yOffset ?? 0, z: 0 }}
            rotationY={modelManifest.node.rotationY ?? 0}
          />
        </ModelOrFallback>
      ) : (
        <CastleKeep tint={tint} />
      )}
      {health === 'Ready' && <Banners />}
      {health === 'Unreachable' && <Beacon />}
    </group>
  );
}

export function NodeBuilding({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const nodes = useMemo(() => buildings.filter((b) => b.resourceType === 'node'), [buildings]);
  if (lod === 'far') return null;
  return (
    <>
      {nodes.map((n) => (
        <NodeLandmark key={n.resourceId} layout={n} />
      ))}
    </>
  );
}

export default NodeBuilding;
