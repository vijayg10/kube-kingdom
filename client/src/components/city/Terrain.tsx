import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { IslandLayout, TerrainLayout, Vec3 } from '../../types/layout';

const ISLAND_DEPTH = 2.5;

// Three concentric grass rings shrink toward center and rise in height —
// producing a hill effect with the shore at y=0 and peak at y=TERRACE[2].y
const TERRACES = [
  { scale: 1.00, y: 0.00, shade: '#5cb83a' }, // shore
  { scale: 0.68, y: 0.65, shade: '#4ea832' }, // mid slope
  { scale: 0.37, y: 1.30, shade: '#3f9428' }, // hilltop
] as const;

const GRASS_TILE = 3.5; // world units per texture tile

function polygonGeometry(vertices: Vec3[]): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  vertices.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.z) : shape.lineTo(p.x, p.z)));
  shape.closePath();
  const geom = new THREE.ShapeGeometry(shape);
  geom.rotateX(-Math.PI / 2);
  // Replace default (0-1 normalised) UVs with world-space XZ so the grass
  // texture tiles at a fixed real-world scale across all three terrace rings.
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const uv  = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2]     =  pos.getX(i) / GRASS_TILE;
    uv[i * 2 + 1] = -pos.getZ(i) / GRASS_TILE;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}

function scaleVertices(vertices: Vec3[], center: Vec3, scale: number): Vec3[] {
  return vertices.map((v) => ({
    x: center.x + (v.x - center.x) * scale,
    y: 0,
    z: center.z + (v.z - center.z) * scale,
  }));
}

/**
 * Cliff segment descriptors. BoxGeometry is used (not PlaneGeometry) because
 * vertical PlaneGeometry meshes corrupt N8AO's depth pre-pass on fresh load.
 * z-negation matches ShapeGeometry's rotateX(-π/2): rendered_z = -p.z.
 */
function cliffSegments(vertices: Vec3[]) {
  return vertices.map((a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    const ax = a.x, az = -a.z;
    const bx = b.x, bz = -b.z;
    const len = Math.max(Math.hypot(bx - ax, bz - az), 0.01);
    const angle = Math.atan2(bz - az, bx - ax);
    return { cx: (ax + bx) / 2, cz: (az + bz) / 2, len, angle };
  });
}

function IslandMesh({ island }: { island: IslandLayout }) {
  const terraceCaps = useMemo(
    () =>
      TERRACES.map(({ scale }) =>
        polygonGeometry(scaleVertices(island.vertices, island.center, scale)),
      ),
    [island.vertices, island.center],
  );

  const outerSegs = useMemo(() => cliffSegments(island.vertices), [island.vertices]);

  const cliffColor = island.isNodePlatform ? '#585450' : '#706a62';

  const grassTex = useTexture('/textures/T_Grass.png');
  useMemo(() => {
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.needsUpdate = true;
  }, [grassTex]);

  return (
    <>
      {/* Stacked grass rings — each smaller and higher, giving a hill silhouette */}
      {TERRACES.map(({ y, shade }, idx) => (
        <mesh key={idx} geometry={terraceCaps[idx]} position={[0, y + 0.01, 0]} receiveShadow castShadow>
          <meshStandardMaterial
            map={island.isNodePlatform ? undefined : grassTex}
            color={island.isNodePlatform ? '#5a7050' : '#ffffff'}
            roughness={0.88}
          />
        </mesh>
      ))}

      {/* Cliff face at island perimeter — BoxGeometry segments (N8AO safe) */}
      {outerSegs.map((s, i) => (
        <mesh
          key={i}
          position={[s.cx, -ISLAND_DEPTH / 2, s.cz]}
          rotation={[0, -s.angle, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[s.len, ISLAND_DEPTH, 0.3]} />
          <meshStandardMaterial color={cliffColor} roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

export function Terrain({ terrain }: { terrain: TerrainLayout }) {
  const { bounds, islands } = terrain;
  const oceanSize = (bounds.max.x - bounds.min.x) * 1.6;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -(ISLAND_DEPTH + 0.15), 0]} receiveShadow>
        <planeGeometry args={[oceanSize, oceanSize]} />
        <meshStandardMaterial
          color="#2a5f78"
          roughness={0.2}
          metalness={0.12}
          transparent
          opacity={0.93}
        />
      </mesh>

      {islands.map((island) => (
        <IslandMesh key={island.nodeId ?? island.namespace} island={island} />
      ))}
    </group>
  );
}

export default Terrain;
