import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useTexture, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';
import { modelManifest } from '../../../render/modelManifest';
import { ModelOrFallback } from '../models/ModelOrFallback';
import { useUiStore } from '../../../store/uiStore';

function handleVaultClick(e: ThreeEvent<MouseEvent>, resourceId: string) {
  e.stopPropagation();
  useUiStore.getState().select({ kind: 'secret', id: resourceId });
}

function handleVaultContextMenu(e: ThreeEvent<MouseEvent>, resourceId: string) {
  e.stopPropagation();
  (e.nativeEvent as MouseEvent).preventDefault();
  useUiStore.getState().openContextMenu({
    x: (e.nativeEvent as MouseEvent).clientX,
    y: (e.nativeEvent as MouseEvent).clientY,
    target: { kind: 'secret', id: resourceId },
  });
}

/**
 * Secret → Fortified vault (US6, T064, FR-023).
 * A heavy stone vault with iron door and subtle golden glow — secrets are
 * valuable and locked. Values are never transmitted (FR-024 parallel).
 */
function VaultGlow({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((s) => {
    if (ref.current) {
      ref.current.intensity = 0.8 + Math.sin(s.clock.elapsedTime * 1.2) * 0.3;
    }
  });
  return <pointLight ref={ref} position={position} color="#c8a020" intensity={0.8} distance={6} />;
}

function ProceduralVault({ b }: { b: BuildingLayout }) {
  const lod = useLOD();
  const brickTex = useTexture('/textures/T_Brick_BaseColor.png');
  useMemo(() => {
    brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
    brickTex.repeat.set(1, 1);
    brickTex.needsUpdate = true;
  }, [brickTex]);

  return (
    <group
      position={[b.position.x, b.position.y, b.position.z]}
      rotation={[0, b.rotationY, 0]}
      onClick={(e) => handleVaultClick(e, b.resourceId)}
      onContextMenu={(e) => handleVaultContextMenu(e, b.resourceId)}
    >
      <mesh castShadow position={[0, 0.65, 0]}>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
        <meshStandardMaterial map={brickTex} color="#9a8878" roughness={0.95} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.65, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial map={brickTex} color="#887868" roughness={0.9} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.55, 0.66]}>
        <boxGeometry args={[0.55, 0.8, 0.06]} />
        <meshStandardMaterial color="#2a2820" roughness={0.6} metalness={0.8} />
      </mesh>
      {[[-0.175, 0.7], [0.175, 0.7], [-0.175, 0.4], [0.175, 0.4]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.695]}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshStandardMaterial color="#c8a040" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {lod === 'close' && <VaultGlow position={[b.position.x, b.position.y + 0.65, b.position.z]} />}
    </group>
  );
}

function VaultInstance({ b }: { b: BuildingLayout }) {
  const lod = useLOD();
  const entry = modelManifest.vault!;
  const { scene } = useGLTF(entry.url);
  const brickTex = useTexture('/textures/T_Brick_BaseColor.png');

  // Clone the scene and bake the brick texture into every mesh material synchronously
  // so it's ready on the first render (useEffect would cause a white-flash frame).
  const cloned = useMemo(() => {
    brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
    brickTex.repeat.set(2, 2);
    brickTex.colorSpace = THREE.SRGBColorSpace;
    brickTex.needsUpdate = true;

    const clone = scene.clone(true);
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = (obj.material as THREE.MeshStandardMaterial).clone();
      mat.map = brickTex;
      mat.needsUpdate = true;
      obj.material = mat;
    });
    return clone;
  }, [scene, brickTex]);

  return (
    <group
      position={[b.position.x, b.position.y, b.position.z]}
      rotation={[0, b.rotationY, 0]}
      onClick={(e) => handleVaultClick(e, b.resourceId)}
      onContextMenu={(e) => handleVaultContextMenu(e, b.resourceId)}
    >
      <primitive
        object={cloned}
        scale={entry.scale}
        position={[0, entry.yOffset ?? 0, 0]}
        rotation={[0, entry.rotationY ?? 0, 0]}
      />
      {lod === 'close' && <VaultGlow position={[0, (entry.yOffset ?? 0) + 1.5, 0]} />}
    </group>
  );
}

export function Vault({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const secrets = useMemo(() => buildings.filter((b) => b.resourceType === 'secret'), [buildings]);

  if (lod === 'far' || secrets.length === 0) return null;

  if (modelManifest.enabled && modelManifest.vault) {
    return (
      <>
        {secrets.map((b) => (
          <ModelOrFallback key={b.resourceId} fallback={<ProceduralVault b={b} />}>
            <VaultInstance b={b} />
          </ModelOrFallback>
        ))}
      </>
    );
  }

  return (
    <>
      {secrets.map((b) => (
        <ProceduralVault key={b.resourceId} b={b} />
      ))}
    </>
  );
}

export default Vault;
