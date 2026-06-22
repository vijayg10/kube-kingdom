import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';

/**
 * ConfigMap → Information well / signpost (US6, T064, FR-023).
 * A decorative well with signposts around it — represents publicly readable config.
 */
export function ConfigInfra({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const cms = useMemo(() => buildings.filter((b) => b.resourceType === 'configmap'), [buildings]);
  if (lod === 'far' || cms.length === 0) return null;
  return (
    <>
      {cms.map((b) => {
        const keyCount = (b.meta?.keys as string[])?.length ?? 2;
        const posts = Math.min(keyCount, 4);
        return (
          <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]}>
            {/* Well base */}
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.7, 0.8, 0.7, 12]} />
              <meshStandardMaterial color="#8a7a64" roughness={0.95} />
            </mesh>
            {/* Well rim */}
            <mesh position={[0, 0.72, 0]}>
              <torusGeometry args={[0.7, 0.1, 6, 12]} />
              <meshStandardMaterial color="#7a6a54" roughness={0.9} />
            </mesh>
            {/* Signposts around the well */}
            {Array.from({ length: posts }).map((_, i) => {
              const a = (i / posts) * Math.PI * 2;
              return (
                <group key={i} position={[Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4]} rotation={[0, -a, 0]}>
                  <mesh position={[0, 0.7, 0]}>
                    <cylinderGeometry args={[0.06, 0.06, 1.4, 6]} />
                    <meshStandardMaterial color="#5a3a18" roughness={0.9} />
                  </mesh>
                  <mesh position={[0.3, 1.1, 0]}>
                    <boxGeometry args={[0.5, 0.2, 0.08]} />
                    <meshStandardMaterial color="#b09060" roughness={0.8} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

export default ConfigInfra;
