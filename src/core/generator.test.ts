import { describe, expect, it } from 'vitest';
import type { Settings } from './config';
import { DEFAULT_SETTINGS } from './config';
import { randomQuestion, uniformQuestion } from './generator';
import { createRng } from './rng';

const custom: Settings = {
  ...DEFAULT_SETTINGS,
  addLeft: { min: 50, max: 60 },
  addRight: { min: 300, max: 310 },
  mulLeft: { min: 13, max: 15 },
  mulRight: { min: 40, max: 45 },
};

const within = (n: number, min: number, max: number) => n >= min && n <= max;

describe('generator', () => {
  it('respects custom ranges for every operation', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const add = randomQuestion('addition', custom, rng);
      expect(within(add.left, 50, 60) && within(add.right, 300, 310)).toBe(true);
      expect(add.answer).toBe(add.left + add.right);

      // (x + y) − x = y
      const sub = randomQuestion('subtraction', custom, rng);
      expect(within(sub.right, 50, 60) && within(sub.answer, 300, 310)).toBe(true);
      expect(sub.left - sub.right).toBe(sub.answer);

      // Operand order is random, so check both orders.
      const mul = randomQuestion('multiplication', custom, rng);
      const ok =
        (within(mul.left, 13, 15) && within(mul.right, 40, 45)) ||
        (within(mul.right, 13, 15) && within(mul.left, 40, 45));
      expect(ok).toBe(true);
      expect(mul.answer).toBe(mul.left * mul.right);

      // (x × y) ÷ x = y
      const div = randomQuestion('division', custom, rng);
      expect(within(div.right, 13, 15) && within(div.answer, 40, 45)).toBe(true);
      expect(div.left / div.right).toBe(div.answer);
    }
  });

  it('shows multiplication operands in both orders', () => {
    const rng = createRng(5);
    let smallFirst = 0;
    for (let i = 0; i < 200; i++) {
      const q = randomQuestion('multiplication', custom, rng);
      if (q.left <= 15) smallFirst++;
    }
    expect(smallFirst).toBeGreaterThan(50);
    expect(smallFirst).toBeLessThan(150);
  });

  it('only uses enabled operations', () => {
    const rng = createRng(9);
    const s: Settings = { ...DEFAULT_SETTINGS, addition: false, subtraction: false, division: false };
    for (let i = 0; i < 200; i++) expect(uniformQuestion(s, rng).op).toBe('multiplication');
  });
});
