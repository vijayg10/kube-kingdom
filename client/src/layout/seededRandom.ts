/**
 * Deterministic hashing + PRNG so the same cluster always yields the same city.
 * Stability is a constitution requirement (Principle II): a pod's position is a
 * pure function of its UID, never recomputed randomly per render.
 */

/** FNV-1a 32-bit hash of a string → unsigned int. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: deterministic [0,1) stream from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded PRNG keyed off an arbitrary string identifier. */
export function rngFor(id: string): () => number {
  return mulberry32(hashString(id));
}

/** Deterministic float in [min, max) for a given id + salt. */
export function seededRange(id: string, salt: string, min: number, max: number): number {
  const r = mulberry32(hashString(id + ':' + salt))();
  return min + r * (max - min);
}
