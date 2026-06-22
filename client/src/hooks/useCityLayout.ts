import { useMemo } from 'react';
import { generateCityLayout } from '../layout/cityLayout';
import { useClusterStore } from '../store/clusterStore';
import type { ClusterState } from '../types/cluster';
import type { CityLayout } from '../types/layout';

/**
 * Memoized city layout. Regenerated only when `topologyVersion` changes
 * (namespace/node/pod membership), never on health-only pod updates — keeping
 * the city stable across pod churn (constitution Principle II).
 */
export function useCityLayout(): CityLayout {
  const topologyVersion = useClusterStore((s) => s.topologyVersion);

  return useMemo(() => {
    const s = useClusterStore.getState();
    const state: ClusterState = {
      namespaces: [...s.namespaces.values()],
      nodes: [...s.nodes.values()],
      pods: [...s.pods.values()],
      services: [...s.services.values()],
      deployments: [...s.deployments.values()],
      ingresses: s.ingresses,
      loadBalancers: s.loadBalancers,
      statefulSets: s.statefulSets,
      daemonSets: s.daemonSets,
      jobs: s.jobs,
      persistentVolumes: s.persistentVolumes,
      hpas: s.hpas,
      configMaps: s.configMaps,
      secrets: s.secrets,
      summary: s.summary ?? {
        totalPods: 0,
        totalNodes: 0,
        cpuPercent: 0,
        memoryPercent: 0,
        healthyPods: 0,
        unhealthyPods: 0,
      },
      snapshotAt: s.snapshotAt ?? new Date().toISOString(),
    };
    return generateCityLayout(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topologyVersion]);
}
