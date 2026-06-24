import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

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

export function Vault({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const secrets = useMemo(() => buildings.filter((b) => b.resourceType === 'secret'), [buildings]);

  const brickTex = useTexture('/textures/T_Brick_BaseColor.png');
  useMemo(() => {
    brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
    brickTex.repeat.set(1, 1);
    brickTex.needsUpdate = true;
  }, [brickTex]);

  if (lod === 'far' || secrets.length === 0) return null;
  return (
    <>
      {secrets.map((b) => (
        <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]} rotation={[0, b.rotationY, 0]}>
          {/* Heavy stone vault body — 50% of original size */}
          <mesh castShadow position={[0, 0.65, 0]}>
            <boxGeometry args={[1.3, 1.3, 1.3]} />
            <meshStandardMaterial map={brickTex} color="#9a8878" roughness={0.95} metalness={0.1} />
          </mesh>
          {/* Domed top — center flush with box top (y=1.3), no gap */}
          <mesh castShadow position={[0, 1.3, 0]}>
            <sphereGeometry args={[0.65, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial map={brickTex} color="#887868" roughness={0.9} metalness={0.15} />
          </mesh>
          {/* Iron door */}
          <mesh position={[0, 0.55, 0.66]}>
            <boxGeometry args={[0.55, 0.8, 0.06]} />
            <meshStandardMaterial color="#2a2820" roughness={0.6} metalness={0.8} />
          </mesh>
          {/* Door bolts */}
          {[[-0.175, 0.7], [0.175, 0.7], [-0.175, 0.4], [0.175, 0.4]].map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.695]}>
              <sphereGeometry args={[0.035, 6, 6]} />
              <meshStandardMaterial color="#c8a040" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
          {lod === 'close' && <VaultGlow position={[b.position.x, b.position.y + 0.65, b.position.z]} />}
        </group>
      ))}
    </>
  );
}

export default Vault;
