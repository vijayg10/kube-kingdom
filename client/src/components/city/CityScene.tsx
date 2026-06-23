import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { Environment, SoftShadows } from '@react-three/drei';
import {
  EffectComposer,
  N8AO,
  SMAA,
  Vignette,
  HueSaturation,
  BrightnessContrast,
} from '@react-three/postprocessing';
import * as THREE from 'three';
import { CityWorld } from './CityWorld';
import { RtsControls } from './RtsControls';
import { useUiStore } from '../../store/uiStore';

/**
 * Root of the 3D world. Sets up the R3F Canvas, the fixed golden-hour lighting
 * rig (constitution Principle I — no day/night cycle), soft shadows, distance
 * fog, and the postprocessing stack (ambient occlusion + antialiasing).
 *
 * City content (terrain, districts, nodes, pods, roads) is layered in by the
 * US1 components after Check-In Gate 1. This file owns only the base scene.
 */

/**
 * Defers the postprocessing stack until after the first scene frame has
 * rendered. N8AO reads the depth buffer on its first pass — if it runs before
 * any geometry is drawn the depth buffer is uninitialized and the entire output
 * goes black. Mounting it one frame late guarantees valid depth data.
 */
function PostFX() {
  const [ready, setReady] = useState(false);
  useFrame(() => { if (!ready) setReady(true); });
  if (!ready) return null;
  return (
    <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={3.5} intensity={1.5} distanceFalloff={1} />
      <HueSaturation saturation={0.12} />
      <BrightnessContrast brightness={0.04} contrast={0.1} />
      <SMAA />
      <Vignette eskil={false} offset={0.22} darkness={0.32} />
    </EffectComposer>
  );
}

// Bright clear-day lighting rig (Quaternius painterly style).
const SUN_POSITION: [number, number, number] = [50, 100, 30];
const SUN_COLOR = '#fff8f0';
const SKY_COLOR = '#c8e0f8';

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.65} color={SKY_COLOR} />
      <hemisphereLight args={[SKY_COLOR, '#4a8c30', 0.85]} />
      <directionalLight
        position={SUN_POSITION}
        intensity={2.8}
        color={SUN_COLOR}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      >
        {/* Tight orthographic shadow frustum around the city footprint. */}
        <orthographicCamera attach="shadow-camera" args={[-120, 120, 120, -120, 0.5, 300]} />
      </directionalLight>
      {/* Cool fill from the opposite side to keep shadows readable. */}
      <directionalLight position={[-50, 40, -30]} intensity={0.6} color="#a8c8f0" />
    </>
  );
}

export function CityScene() {
  return (
    <Canvas
      shadows
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
      camera={{ position: [80, 90, 80], fov: 35, near: 1, far: 1000 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color('#7ac0e8');
      }}
      onPointerMissed={() => useUiStore.getState().closeDetail()}
    >
      <SoftShadows size={28} samples={12} focus={0.7} />
      <Lighting />
      <RtsControls />
      <Suspense fallback={null}>
        <Environment preset="park" />
        <CityWorld />
        <PostFX />
      </Suspense>
    </Canvas>
  );
}

export default CityScene;
