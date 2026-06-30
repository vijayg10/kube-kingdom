import { useGLTF, Clone } from '@react-three/drei';
import type { Vec3 } from '../../../types/layout';
import { hashString, mulberry32 } from '../../../layout/seededRandom';
import { modelManifest } from '../../../render/modelManifest';
import { useLOD } from '../../../hooks/useLOD';

// Grass is handled by GrassField (instanced). This component places only
// larger, sparser bushes and plants.
const COVER_VARIANTS = [
  '/models/nature/Bush_Common.gltf',
  '/models/nature/Bush_Common_Flowers.gltf',
  '/models/nature/Plant_1.gltf',
  '/models/nature/Plant_1_Big.gltf',
];

COVER_VARIANTS.forEach((url) => useGLTF.preload(url));

function coverVariant(p: Vec3): string {
  const idx = hashString(`gc:${p.x.toFixed(1)},${p.z.toFixed(1)}`) % COVER_VARIANTS.length;
  return COVER_VARIANTS[idx];
}

function CoverItem({ position }: { position: Vec3 }) {
  const url = coverVariant(position);
  const { scene } = useGLTF(url);
  const rng = mulberry32(hashString(`gcr:${position.x.toFixed(1)},${position.z.toFixed(1)}`));
  const scale = 0.7 + rng() * 0.6;
  const rotY = rng() * Math.PI * 2;
  return (
    <Clone
      object={scene}
      position={[position.x, position.y ?? 0, position.z]}
      scale={scale}
      rotation={[0, rotY, 0]}
      receiveShadow
    />
  );
}

export function GroundCover({ positions }: { positions: Vec3[] }) {
  const lod = useLOD();
  if (!modelManifest.enabled || lod === 'far' || positions.length === 0) return null;
  return (
    <>
      {positions.map((p, i) => (
        <CoverItem key={i} position={p} />
      ))}
    </>
  );
}

export default GroundCover;
