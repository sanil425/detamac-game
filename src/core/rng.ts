// A random number generator is just a function returning a number in [0, 1).
export type Rng = () => number;

// mulberry32: a small, fast, seedable generator. The same seed gives the same sequence.
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uniform integer in [lo, hi], inclusive. Order of lo and hi doesn't matter.
export function randInt(rng: Rng, lo: number, hi: number): number {
  const min = Math.min(lo, hi);
  const max = Math.max(lo, hi);
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick an index with probability proportional to its weight.
export function weightedIndex(rng: Rng, weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
