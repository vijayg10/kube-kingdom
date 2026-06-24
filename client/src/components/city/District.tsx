import { Text } from '@react-three/drei';
import type { DistrictLayout } from '../../types/layout';
import { useLOD } from '../../hooks/useLOD';

export function DistrictPatch({ district }: { district: DistrictLayout }) {
  const lod = useLOD();
  const { center, namespace, radius } = district;

  return (
    <group position={[center.x, 0, center.z]}>
      {lod !== 'close' && (
        <Text
          position={[0, 5, 0]}
          fontSize={Math.max(3, radius * 0.18)}
          color="#2b2014"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.15}
          outlineColor="#e8d9b5"
        >
          {namespace}
        </Text>
      )}
    </group>
  );
}

export function Districts({ districts }: { districts: DistrictLayout[] }) {
  return (
    <>
      {districts.map((d) => (
        <DistrictPatch key={d.namespace} district={d} />
      ))}
    </>
  );
}

export default Districts;
