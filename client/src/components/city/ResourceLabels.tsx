import { useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import type { BuildingLayout, BuildingResourceType } from '../../types/layout';
import { useClusterStore } from '../../store/clusterStore';
import { useLOD } from '../../hooks/useLOD';

const RESOURCE_COLOR: Record<BuildingResourceType, string> = {
  pod:          '#f5d000', // gold
  node:         '#4fc3f7', // sky blue
  statefulset:  '#ce93d8', // lavender
  daemonset:    '#ffb74d', // amber
  job:          '#81c784', // sage green
  ingress:      '#4dd0e1', // cyan
  loadbalancer: '#f48fb1', // pink
  pv:           '#bcaaa4', // taupe
  hpa:          '#aed581', // lime
  configmap:    '#90caf9', // cornflower
  secret:       '#ef9a9a', // rose
};

const RESOURCE_PREFIX: Record<BuildingResourceType, string> = {
  pod:          'Pod',
  node:         'Node',
  statefulset:  'STS',
  daemonset:    'DS',
  job:          'Job',
  ingress:      'Ingress',
  loadbalancer: 'LB',
  pv:           'PV',
  hpa:          'HPA',
  configmap:    'CM',
  secret:       'Secret',
};

// Extra Y above the building base so labels sit above the model.
const LABEL_Y_OFFSET: Record<BuildingResourceType, number> = {
  pod:          4.5,
  node:         14,
  statefulset:  6,
  daemonset:    7,
  job:          5,
  ingress:      6,
  loadbalancer: 6,
  pv:           5,
  hpa:          6,
  configmap:    5,
  secret:       5,
};

export function ResourceLabels({ buildings }: { buildings: BuildingLayout[] }) {
  const lod = useLOD();
  const pods = useClusterStore((s) => s.pods);
  const nodes = useClusterStore((s) => s.nodes);
  const ingresses = useClusterStore((s) => s.ingresses);
  const loadBalancers = useClusterStore((s) => s.loadBalancers);
  const persistentVolumes = useClusterStore((s) => s.persistentVolumes);
  const hpas = useClusterStore((s) => s.hpas);
  const configMaps = useClusterStore((s) => s.configMaps);
  const secrets = useClusterStore((s) => s.secrets);

  // uid → name map for array-based extended resources.
  const extNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of [...ingresses, ...loadBalancers, ...persistentVolumes, ...hpas, ...configMaps, ...secrets]) {
      m.set(r.uid, r.name);
    }
    return m;
  }, [ingresses, loadBalancers, persistentVolumes, hpas, configMaps, secrets]);

  if (lod === 'far') return null;

  return (
    <>
      {buildings.map((b) => {
        let name: string;
        if (b.resourceType === 'pod') {
          name = pods.get(b.resourceId)?.name ?? b.resourceId.slice(0, 8);
        } else if (b.resourceType === 'node') {
          name = nodes.get(b.resourceId)?.name ?? b.resourceId;
        } else if (b.meta?.name && typeof b.meta.name === 'string') {
          // statefulset, daemonset, job store name in meta
          name = b.meta.name;
        } else {
          name = extNames.get(b.resourceId) ?? b.resourceId.slice(0, 8);
        }

        const yOffset = LABEL_Y_OFFSET[b.resourceType];
        return (
          <Billboard
            key={b.resourceId}
            position={[b.position.x, b.position.y + yOffset, b.position.z]}
          >
            <Text
              fontSize={0.35}
              color={RESOURCE_COLOR[b.resourceType]}
              anchorX="center"
              anchorY="middle"
            >
              {RESOURCE_PREFIX[b.resourceType] + ': ' + name}
            </Text>
          </Billboard>
        );
      })}
    </>
  );
}

export default ResourceLabels;
