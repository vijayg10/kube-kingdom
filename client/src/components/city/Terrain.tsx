import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
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

// Smooth a closed polygon through its control points using a Catmull-Rom spline.
function smoothPolygon(vertices: Vec3[], samples = 72): Vec3[] {
  if (vertices.length < 3) return vertices;
  const pts = vertices.map((v) => new THREE.Vector3(v.x, 0, v.z));
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return curve.getPoints(samples).map((p) => ({ x: p.x, y: 0, z: p.z }));
}

function polygonGeometry(vertices: Vec3[]): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // ShapeGeometry + rotateX(-π/2) maps shape Y → world -Z, so negate Z here to
  // keep the grass in the same +Z layout space as props/buildings/roads (see Road.tsx).
  vertices.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.z) : shape.lineTo(p.x, -p.z)));
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

const SHORE_OUT  = 8.8;  // horizontal distance the slope extends outward
const SHORE_TILE = 3.0;  // world units per texture tile on the shore

// Single continuous ring geometry for the island shore — no per-segment seams.
// Top ring sits at y=0 (shore level); bottom ring is pushed outward + downward.
function shoreGeometry(vertices: Vec3[], center: Vec3, shoreOut = SHORE_OUT): THREE.BufferGeometry {
  const n = vertices.length;
  const BOT_Y    = -(ISLAND_DEPTH + 0.4);
  const slopeLen = Math.hypot(shoreOut, ISLAND_DEPTH + 0.4);
  const vMax     = slopeLen / SHORE_TILE;

  const pos = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const idx: number[] = [];

  let perim = 0;
  const cum: number[] = [0];
  for (let i = 0; i < n; i++) {
    const a = vertices[i], b = vertices[(i + 1) % n];
    perim += Math.hypot(b.x - a.x, b.z - a.z);
    cum.push(perim);
  }

  for (let i = 0; i < n; i++) {
    const v = vertices[i];
    const wx = v.x, wz = v.z;
    const dx = wx - center.x, dz = wz - center.z;
    const dl = Math.hypot(dx, dz) || 1;
    const ox = dx / dl, oz = dz / dl;
    const u = cum[i] / SHORE_TILE; // world-distance-based U — same scale as V

    pos[i * 3]     = wx; pos[i * 3 + 1] = 0.05; pos[i * 3 + 2] = wz;
    uvs[i * 2]     = u;  uvs[i * 2 + 1] = 0;

    const b = n + i;
    pos[b * 3]     = wx + ox * shoreOut;
    pos[b * 3 + 1] = BOT_Y;
    pos[b * 3 + 2] = wz + oz * SHORE_OUT;
    uvs[b * 2]     = u; uvs[b * 2 + 1] = vMax;
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Winding reversed vs. the un-negated layout so face normals stay up after
    // the Z-negation that keeps the shore aligned with the grass cap.
    idx.push(i, j, n + i);
    idx.push(n + i, j, n + j);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return geom;
}

function Ocean({ size, y }: { size: number; y: number }) {
  const noiseBase = useTexture('/textures/T_Noise_Terrain.png');

  // Two clones scroll independently — one for bump, one for roughness variation.
  const [bumpTex, roughTex] = useMemo(() => {
    const a = noiseBase.clone();
    const b = noiseBase.clone();
    [a, b].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(14, 14);
      t.needsUpdate = true;
    });
    return [a, b];
  }, [noiseBase]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    bumpTex.offset.set( t * 0.022,  t * 0.014);
    roughTex.offset.set(-t * 0.016,  t * 0.021);
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <planeGeometry args={[size, size, 1, 1]} />
      <meshPhysicalMaterial
        color="#1e5a80"
        bumpMap={bumpTex}
        bumpScale={5.5}
        roughnessMap={roughTex}
        roughness={0.02}
        metalness={0.0}
        reflectivity={1.0}
        envMapIntensity={2.5}
        ior={1.33}
        transparent
        opacity={0.94}
      />
    </mesh>
  );
}

function IslandMesh({ island }: { island: IslandLayout }) {
  // Pre-smooth once; terrace caps and shore both use the same smoothed boundary
  // so they align perfectly and there are no sharp-cornered seams.
  const smoothed = useMemo(() => smoothPolygon(island.vertices, 72), [island.vertices]);

  const terraceCaps = useMemo(
    () =>
      TERRACES.map(({ scale }) =>
        polygonGeometry(scaleVertices(smoothed, island.center, scale)),
      ),
    [smoothed, island.center],
  );

  const shoreGeom = useMemo(
    () => shoreGeometry(smoothed, island.center, island.isNodePlatform ? 3.5 : SHORE_OUT),
    [smoothed, island.center, island.isNodePlatform],
  );

  const grassTex = useTexture('/textures/T_Grass.png');
  const shoreTex = useTexture('/textures/T_Sand.png');
  const rockTex  = useTexture('/textures/T_UnevenBrick_BaseColor.png');

  useMemo(() => {
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.needsUpdate = true;
    shoreTex.wrapS = shoreTex.wrapT = THREE.RepeatWrapping;
    shoreTex.needsUpdate = true;
    rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;
    rockTex.repeat.set(2, 2);
    rockTex.needsUpdate = true;
  }, [grassTex, shoreTex, rockTex]);

  return (
    <>
      {/* Stacked grass rings — each smaller and higher, giving a hill silhouette */}
      {TERRACES.map(({ y }, idx) => (
        <mesh key={idx} geometry={terraceCaps[idx]} position={[0, y + 0.01, 0]} receiveShadow castShadow>
          <meshStandardMaterial
            map={island.isNodePlatform ? rockTex : grassTex}
            color="#ffffff"
            roughness={island.isNodePlatform ? 0.95 : 0.88}
          />
        </mesh>
      ))}

      {/* Continuous shore ring — single mesh, no per-segment joints */}
      <mesh geometry={shoreGeom} receiveShadow castShadow>
        <meshStandardMaterial
          map={island.isNodePlatform ? rockTex : shoreTex}
          color="#ffffff"
          roughness={island.isNodePlatform ? 0.95 : 0.92}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

export function Terrain({ terrain }: { terrain: TerrainLayout }) {
  const { bounds, islands } = terrain;
  const oceanSize = (bounds.max.x - bounds.min.x) * 1.6;

  return (
    <group>
      <Ocean size={oceanSize} y={-(ISLAND_DEPTH + 0.15)} />

      {islands.map((island) => (
        <IslandMesh key={island.nodeId ?? island.namespace} island={island} />
      ))}
    </group>
  );
}

export default Terrain;
