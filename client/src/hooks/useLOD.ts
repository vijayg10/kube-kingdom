import { useFrame } from '@react-three/fiber';
import { create } from 'zustand';

export type LodLevel = 'far' | 'mid' | 'close';

interface LodStore {
  level: LodLevel;
  setLevel: (l: LodLevel) => void;
}

/**
 * Discrete LOD level derived from camera height (research.md §2, constitution
 * Principle III). Updated only when the level actually changes, so it never
 * spams React re-renders during continuous camera motion.
 */
export const useLodStore = create<LodStore>((set) => ({
  level: 'mid',
  setLevel: (level) => set((s) => (s.level === level ? s : { level })),
}));

// Camera-height thresholds for level transitions.
const FAR_ABOVE = 150; // above this height → districts only
const CLOSE_BELOW = 55; // below this height → full detail

/**
 * Drop inside <Canvas>. Each frame, classifies the camera height into a LOD
 * level and publishes it to {@link useLodStore}.
 */
export function LodController() {
  const setLevel = useLodStore((s) => s.setLevel);
  useFrame(({ camera }) => {
    const h = camera.position.y;
    const level: LodLevel = h > FAR_ABOVE ? 'far' : h < CLOSE_BELOW ? 'close' : 'mid';
    setLevel(level);
  });
  return null;
}

/** Read the current LOD level (subscribes to changes only). */
export function useLOD(): LodLevel {
  return useLodStore((s) => s.level);
}
