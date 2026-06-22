import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';
import type { MapControls as MapControlsImpl } from 'three-stdlib';
import { useUiStore } from '../../store/uiStore';
import { sceneRefs } from '../../render/sceneRefs';

/**
 * Classic RTS camera (PROMPT Controls): WASD / edge-scroll pan, scroll-wheel
 * zoom, middle-mouse rotate. Left-drag also pans. Minimap clicks set
 * uiStore.cameraTarget, which we smoothly fly the camera to.
 */

const keys = { w: false, a: false, s: false, d: false };
const UP = new THREE.Vector3(0, 1, 0);
const EDGE = 12; // px edge-scroll band

export function RtsControls() {
  const { camera, gl } = useThree();
  const controlsRef = useRef<MapControlsImpl>(null);
  const pointer = useRef({ x: 0.5, y: 0.5, inside: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => setKey(e.code, true);
    const up = (e: KeyboardEvent) => setKey(e.code, false);
    const move = (e: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      pointer.current = {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
        inside: true,
      };
    };
    const leave = () => (pointer.current.inside = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    gl.domElement.addEventListener('pointermove', move);
    gl.domElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      gl.domElement.removeEventListener('pointermove', move);
      gl.domElement.removeEventListener('pointerleave', leave);
    };
  }, [gl]);

  // Configure mouse buttons + publish refs for DOM-side overlays (box-select).
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    sceneRefs.camera = camera;
    sceneRefs.controls = c;
    return () => {
      sceneRefs.controls = null;
    };
  }, [camera]);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const c = controlsRef.current;
    if (!c) return;

    // --- Minimap fly-to -------------------------------------------------
    const target = useUiStore.getState().cameraTarget;
    if (target) {
      const dest = new THREE.Vector3(target[0], 0, target[1]);
      const offset = camera.position.clone().sub(c.target);
      c.target.lerp(dest, Math.min(1, dt * 4));
      camera.position.copy(c.target).add(offset);
      if (c.target.distanceTo(dest) < 1.5) useUiStore.getState().setCameraTarget(null);
      c.update();
      return;
    }

    // --- WASD + edge-scroll pan ----------------------------------------
    forward.current.set(0, 0, 0);
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(forward.current, UP).normalize();

    let fwd = 0;
    let strafe = 0;
    if (keys.w) fwd += 1;
    if (keys.s) fwd -= 1;
    if (keys.d) strafe += 1;
    if (keys.a) strafe -= 1;

    const p = pointer.current;
    if (p.inside) {
      if (p.y < EDGE / window.innerHeight) fwd += 1;
      if (p.y > 1 - EDGE / window.innerHeight) fwd -= 1;
      if (p.x > 1 - EDGE / window.innerWidth) strafe += 1;
      if (p.x < EDGE / window.innerWidth) strafe -= 1;
    }

    if (fwd !== 0 || strafe !== 0) {
      move.current.set(0, 0, 0);
      move.current.addScaledVector(forward.current, fwd);
      move.current.addScaledVector(right.current, strafe);
      move.current.normalize().multiplyScalar(camera.position.y * 0.9 * dt);
      camera.position.add(move.current);
      c.target.add(move.current);
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableRotate
      enableDamping
      dampingFactor={0.12}
      minDistance={20}
      maxDistance={320}
      maxPolarAngle={Math.PI / 2.2}
    />
  );
}

function setKey(code: string, value: boolean) {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.w = value;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.a = value;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.s = value;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.d = value;
      break;
  }
}

export default RtsControls;
