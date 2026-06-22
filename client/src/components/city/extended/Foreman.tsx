import { useMemo } from 'react';
import type { BuildingLayout } from '../../../types/layout';
import { useLOD } from '../../../hooks/useLOD';
import { useClusterStore } from '../../../store/clusterStore';
import type { HPA } from '../../../types/cluster';

/**
 * HPA → Construction Foreman station (US6, T065, FR-023).
 * A scaffold + foreman hut showing current/min/max scale. Visual indicator of
 * the HPA's control range (min–max replica band shown as colored posts).
 */
export function Foreman({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const hpas = useMemo(() => buildings.filter((b) => b.resourceType === 'hpa'), [buildings]);
  const hpaMap = useMemo<Map<string, HPA>>(() => {
    const m = new Map<string, HPA>();
    for (const h of useClusterStore.getState().hpas) m.set(h.uid, h);
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpas]);

  if (lod === 'far' || hpas.length === 0) return null;
  return (
    <>
      {hpas.map((b) => {
        const min = (b.meta?.min as number) ?? 1;
        const max = (b.meta?.max as number) ?? 5;
        const curr = hpaMap.get(b.resourceId)?.currentReplicas ?? min;
        const fill = Math.max(0, Math.min(1, (curr - min) / Math.max(1, max - min)));
        return (
          <group key={b.resourceId} position={[b.position.x, b.position.y, b.position.z]} rotation={[0, b.rotationY, 0]}>
            {/* Foreman hut */}
            <mesh castShadow position={[0, 0.9, 0]}>
              <boxGeometry args={[2, 1.8, 1.8]} />
              <meshStandardMaterial color="#b09060" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.0, 0]}>
              <boxGeometry args={[2.1, 0.5, 1.9]} />
              <meshStandardMaterial color="#6a3a1a" roughness={0.85} />
            </mesh>
            {/* Scale bar: min → max range (5 posts) */}
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i / 4 <= fill;
              return (
                <mesh key={i} castShadow position={[-1.6 + i * 0.8, 0.5, 1.1]}>
                  <boxGeometry args={[0.2, 1.0, 0.2]} />
                  <meshStandardMaterial color={filled ? '#5fae4c' : '#6a5a48'} roughness={0.8} />
                </mesh>
              );
            })}
            {/* Scaffold pole */}
            <mesh position={[1.2, 1.5, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 3, 6]} />
              <meshStandardMaterial color="#4a3a28" roughness={0.9} />
            </mesh>
            <mesh position={[1.2, 3.1, 0]}>
              <boxGeometry args={[0.7, 0.08, 0.08]} />
              <meshStandardMaterial color="#4a3a28" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export default Foreman;
