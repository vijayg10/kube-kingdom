import { useMemo } from 'react';
import type { BuildingLayout, Vec3 } from '../../../types/layout';
import { useClusterStore } from '../../../store/clusterStore';
import { useLOD } from '../../../hooks/useLOD';
import { POD_HEALTH_COLOR } from '../health';
import { FireEffect } from './FireEffect';
import { SmokeParticles } from './SmokeParticles';
import { HealthGlow, type GlowSite } from './HealthGlow';
import { Scaffolding, Ruin } from './StateOverlays';

/**
 * Derives health-effect sites from live pod health + stable building positions,
 * then drives the fire / smoke / glow systems. Recomputes only when the pod map
 * changes (every few seconds), never per frame. Capped for performance.
 */
const MAX_SITES = 60;

export function PodEffects({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const pods = useClusterStore((s) => s.pods);

  const { fire, smoke, glow, pending, evicted } = useMemo(() => {
    const posById = new Map<string, Vec3>();
    for (const b of buildings) if (b.resourceType === 'pod') posById.set(b.resourceId, b.position);

    const fireS: Vec3[] = [];
    const smokeS: Vec3[] = [];
    const glowS: GlowSite[] = [];
    const pendingS: Vec3[] = [];
    const evictedS: Vec3[] = [];
    for (const [uid, pod] of pods) {
      const pos = posById.get(uid);
      if (!pos) continue;
      if (pod.health === 'CrashLoopBackOff') {
        if (fireS.length < MAX_SITES) fireS.push(pos);
        if (smokeS.length < MAX_SITES) smokeS.push(pos);
        glowS.push({ pos, color: POD_HEALTH_COLOR.CrashLoopBackOff });
      } else if (pod.health === 'Restarting') {
        glowS.push({ pos, color: POD_HEALTH_COLOR.Restarting });
      } else if (pod.health === 'Pending') {
        if (pendingS.length < MAX_SITES) pendingS.push(pos);
      } else if (pod.health === 'Evicted') {
        if (evictedS.length < MAX_SITES) evictedS.push(pos);
      }
    }
    return {
      fire: fireS,
      smoke: smokeS,
      glow: glowS.slice(0, MAX_SITES),
      pending: pendingS,
      evicted: evictedS,
    };
  }, [pods, buildings]);

  if (lod === 'far') return null;

  return (
    <>
      <FireEffect sites={fire} />
      <SmokeParticles sites={smoke} />
      <HealthGlow sites={glow} />
      <Scaffolding sites={pending} />
      <Ruin sites={evicted} />
    </>
  );
}

export default PodEffects;
