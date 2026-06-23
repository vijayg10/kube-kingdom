import { useEffect, useRef } from 'react';
import { useGLTF, Clone } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from '../../../types/layout';
import { hashString, mulberry32 } from '../../../layout/seededRandom';
import { modelManifest } from '../../../render/modelManifest';

const TREE_VARIANTS = [
  '/models/nature/CommonTree_1.gltf',
  '/models/nature/CommonTree_2.gltf',
  '/models/nature/CommonTree_3.gltf',
  '/models/nature/CommonTree_4.gltf',
  '/models/nature/CommonTree_5.gltf',
  '/models/nature/Pine_1.gltf',
  '/models/nature/Pine_2.gltf',
  '/models/nature/Pine_3.gltf',
  '/models/nature/Pine_4.gltf',
  '/models/nature/Pine_5.gltf',
];

// Preload all variants up front so they're cached before first render.
TREE_VARIANTS.forEach((url) => useGLTF.preload(url));

function treeVariant(p: Vec3): string {
  const idx = hashString(`tree:${p.x.toFixed(1)},${p.z.toFixed(1)}`) % TREE_VARIANTS.length;
  return TREE_VARIANTS[idx];
}

function treeScale(p: Vec3): number {
  const rng = mulberry32(hashString(`treescale:${p.x.toFixed(1)},${p.z.toFixed(1)}`));
  return 0.8 + rng() * 0.6;
}

function treeRotation(p: Vec3): number {
  const rng = mulberry32(hashString(`treery:${p.x.toFixed(1)},${p.z.toFixed(1)}`));
  return rng() * Math.PI * 2;
}

/** Single model tree — loads from cache via Clone. */
function ModelTree({ position }: { position: Vec3 }) {
  const url = treeVariant(position);
  const { scene } = useGLTF(url);
  const scale = treeScale(position);
  const rotY = treeRotation(position);
  return (
    <Clone
      object={scene}
      position={[position.x, position.y ?? 0, position.z]}
      scale={scale}
      rotation={[0, rotY, 0]}
      castShadow
      receiveShadow
    />
  );
}

// ── Procedural fallback (unchanged from original) ────────────────────────────

const _d = new THREE.Object3D();

const trunkGeom = new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6);
trunkGeom.translate(0, 0.55, 0);

const foliageGeom = new THREE.ConeGeometry(0.95, 1.6, 7);
foliageGeom.translate(0, 1.7, 0);

const foliageTipGeom = new THREE.ConeGeometry(0.7, 1.2, 7);
foliageTipGeom.translate(0, 2.6, 0);

function ProceduralTrees({ positions }: { positions: Vec3[] }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);
  const tipRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const trunk = trunkRef.current;
    const foliage = foliageRef.current;
    const tip = tipRef.current;
    if (!trunk || !foliage || !tip) return;

    positions.forEach((p, i) => {
      const rng = mulberry32(hashString(`tree:${p.x.toFixed(1)},${p.z.toFixed(1)}`));
      const scale = 0.8 + rng() * 0.9;
      const ry = rng() * Math.PI * 2;
      _d.position.set(p.x, 0, p.z);
      _d.rotation.set(0, ry, 0);
      _d.scale.set(scale, scale * (0.9 + rng() * 0.4), scale);
      _d.updateMatrix();
      trunk.setMatrixAt(i, _d.matrix);
      foliage.setMatrixAt(i, _d.matrix);
      tip.setMatrixAt(i, _d.matrix);
    });

    trunk.count = positions.length;
    foliage.count = positions.length;
    tip.count = positions.length;
    trunk.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    tip.instanceMatrix.needsUpdate = true;
    trunk.computeBoundingSphere();
    foliage.computeBoundingSphere();
    tip.computeBoundingSphere();
  }, [positions]);

  if (positions.length === 0) return null;

  return (
    <>
      <instancedMesh ref={trunkRef} args={[trunkGeom, undefined, positions.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color="#6b4a2b" roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={foliageRef} args={[foliageGeom, undefined, positions.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color="#3f7d3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={tipRef} args={[foliageTipGeom, undefined, positions.length]} castShadow receiveShadow frustumCulled>
        <meshStandardMaterial color="#4f9145" roughness={0.9} />
      </instancedMesh>
    </>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function Trees({ positions }: { positions: Vec3[] }) {
  if (positions.length === 0) return null;

  if (modelManifest.enabled && modelManifest.tree) {
    return (
      <>
        {positions.map((p, i) => (
          <ModelTree key={i} position={p} />
        ))}
      </>
    );
  }

  return <ProceduralTrees positions={positions} />;
}

export default Trees;
