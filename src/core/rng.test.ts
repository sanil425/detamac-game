import { describe, expect, it } from 'vitest';
import { createRng, randInt, weightedIndex } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('randInt stays within inclusive bounds and hits both ends', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = randInt(rng, 3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('weightedIndex never picks a zero-weight item', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) expect(weightedIndex(rng, [0, 1, 0, 3])).not.toBe(0);
  });
});
