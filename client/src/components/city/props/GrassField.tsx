import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useLOD } from '../../../hooks/useLOD';
import type { TerrainLayout } from '../../../types/layout';
import { mulberry32, hashString } from '../../../layout/seededRandom';

// ~0.55 tufts per unit² → ~800–1 200 tufts per island, single draw call.
const DENSITY = 0.55;
const BLADE_W = 0.44;
const BLADE_H = 0.38;

const GRASS_COLORS = [
  new THREE.Color('#6ea030'),
  new THREE.Color('#5a9028'),
  new THREE.Color('#78a838'),
  new THREE.Color('#62b030'),
  new THREE.Color('#4e8820'),
  new THREE.Color('#72aa2c'),
];

function buildGrassGeometry(): THREE.BufferGeometry {
  const hw = BLADE_W / 2;
  const h  = BLADE_H;
  // Two crossed vertical quads forming an "X" tuft.
  const positions = new Float32Array([
    -hw, 0, 0,   hw, 0, 0,   hw, h, 0,  -hw, h, 0,   // plane along X
     0, 0,-hw,    0, 0, hw,   0, h, hw,   0, h,-hw,   // plane along Z
  ]);
  const uvs = new Float32Array([
    0,0, 1,0, 1,1, 0,1,
    0,0, 1,0, 1,1, 0,1,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
  geom.setIndex([0,1,2, 0,2,3, 4,5,6, 4,6,7]);
  geom.computeVertexNormals();
  return geom;
}

const _dummy = new THREE.Object3D();

type TuftData = { x: number; z: number; scale: number; ry: number; ci: number };

export function GrassField({ terrain }: { terrain: TerrainLayout }) {
  const lod = useLOD();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(buildGrassGeometry, []);
  const mat  = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6ea030',
    roughness: 0.88,
    side: THREE.DoubleSide,
  }), []);

  const tufts = useMemo<TuftData[]>(() => {
    const pts: TuftData[] = [];
    for (const island of terrain.islands) {
      const { center, vertices, namespace } = island;
      const maxR = Math.max(...vertices.map(v => Math.hypot(v.x - center.x, v.z - center.z))) * 0.88;
      const count = Math.floor(Math.PI * maxR * maxR * DENSITY);
      const rng = mulberry32(hashString('gf:' + namespace));
      for (let i = 0; i < count; i++) {
        const r  = maxR * Math.sqrt(rng());
        const a  = rng() * Math.PI * 2;
        pts.push({
          x:  center.x + Math.cos(a) * r,
          z:  center.z + Math.sin(a) * r,
          scale: 0.65 + rng() * 0.7,
          ry: rng() * Math.PI * 2,
          ci: Math.floor(rng() * GRASS_COLORS.length),
        });
      }
    }
    return pts;
  }, [terrain.islands]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    tufts.forEach((t, i) => {
      _dummy.position.set(t.x, 0, t.z);
      _dummy.rotation.set(0, t.ry, 0);
      _dummy.scale.setScalar(t.scale);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, GRASS_COLORS[t.ci]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tufts]);

  if (lod === 'far' || tufts.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geom, mat, tufts.length]}
      receiveShadow
      frustumCulled
    />
  );
}

export default GrassField;
