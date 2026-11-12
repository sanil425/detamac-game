import { describe, expect, it } from 'vitest';
import type { Operation, Settings } from './config';
import { DEFAULT_SETTINGS, OPERATIONS, WARMUP_ANSWERS } from './config';
import type { Question } from './generator';
import { sameQuestion } from './generator';
import { groupId } from './groups';
import type { ModelState } from './model';
import { emptyModel } from './model';
import { createRng } from './rng';
import { nextQuestion, operationShares, questionInGroup } from './sampler';

// A model past warm-up where multiplication ×7 is very slow.
function trainedModel(): ModelState {
  const m = emptyModel();
  m.totalAnswers = WARMUP_ANSWERS + 50;
  m.operations = {
    addition: { fast: 1000, slow: 1000, count: 50, lastSeen: 0 },
    subtraction: { fast: 1200, slow: 1200, count: 50, lastSeen: 0 },
    multiplication: { fast: 1500, slow: 1500, count: 50, lastSeen: 0 },
    division: { fast: 30000, slow: 30000, count: 50, lastSeen: 0 },
  };
  m.groups['mul:7:le12'] = { fast: 6000, slow: 6000, count: 20, lastSeen: 0 };
  return m;
}

function sequence(mode: 'ranked' | 'practice', model: ModelState, settings: Settings, seed: number, n: number) {
  const rng = createRng(seed);
  const out: Question[] = [];
  let prev: Question | null = null;
  for (let i = 0; i < n; i++) {
    prev = nextQuestion({ mode, settings, model, rng, previous: prev });
    out.push(prev);
  }
  return out;
}

describe('sampler', () => {
  it('ranked generation ignores the model and the settings', () => {
    const custom: Settings = { ...DEFAULT_SETTINGS, addition: false, mulLeft: { min: 7, max: 7 } };
    const a = sequence('ranked', emptyModel(), DEFAULT_SETTINGS, 99, 300);
    const b = sequence('ranked', trainedModel(), custom, 99, 300);
    expect(b).toEqual(a);
  });

  it('practice is uniform during warm-up (matches ranked draws on default settings)', () => {
    const warm = emptyModel();
    const a = sequence('practice', warm, DEFAULT_SETTINGS, 4, 200);
    const b = sequence('ranked', trainedModel(), DEFAULT_SETTINGS, 4, 200);
    expect(a).toEqual(b);
  });

  it('operation shares stay within [0.5u, 2u] and sum to 1', () => {
    const rng = createRng(21);
    const subsets: Operation[][] = [OPERATIONS, ['addition', 'division'], ['addition', 'subtraction', 'division']];
    for (let trial = 0; trial < 500; trial++) {
      const m = emptyModel();
      for (const op of OPERATIONS) {
        // Very skewed EWMAs, sometimes missing.
        if (rng() < 0.85) m.operations[op] = { fast: 1 + rng() ** 4 * 20000, slow: 1, count: 10, lastSeen: 0 };
      }
      for (const ops of subsets) {
        const shares = operationShares(ops, m);
        const u = 1 / ops.length;
        const total = ops.reduce((s, op) => s + shares[op], 0);
        expect(total).toBeCloseTo(1, 9);
        for (const op of ops) {
          expect(shares[op]).toBeGreaterThanOrEqual(0.5 * u - 1e-9);
          expect(shares[op]).toBeLessThanOrEqual(2 * u + 1e-9);
        }
      }
    }
  });

  it('caps a dominant operation at 50% with all four enabled', () => {
    const shares = operationShares(OPERATIONS, trainedModel());
    expect(shares.division).toBeCloseTo(0.5);
    expect(shares.addition).toBeGreaterThanOrEqual(0.125);
  });

  it('gives a single enabled operation 100%', () => {
    expect(operationShares(['division'], trainedModel())).toEqual({ division: 1 });
  });

  it('questionInGroup lands in the requested group', () => {
    const rng = createRng(8);
    for (let i = 0; i < 50; i++) {
      expect(groupId(questionInGroup('addition', 'add:carry:1+1:le100', DEFAULT_SETTINGS, rng))).toBe(
        'add:carry:1+1:le100',
      );
    }
  });

  it('targets slow groups after warm-up', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, addition: false, subtraction: false, division: false };
    const qs = sequence('practice', trainedModel(), settings, 12, 2000);
    const sevens = qs.filter((q) => groupId(q) === 'mul:7:le12').length;
    // Uniform would give ~1/11 × 11/99 ≈ 1%; targeting should push it far higher.
    expect(sevens / qs.length).toBeGreaterThan(0.05);
  });

  it('never shows the same question twice in a row', () => {
    const tiny: Settings = {
      ...DEFAULT_SETTINGS,
      subtraction: false,
      multiplication: false,
      division: false,
      addLeft: { min: 2, max: 3 },
      addRight: { min: 2, max: 3 },
    };
    for (const [mode, model, settings] of [
      ['practice', emptyModel(), tiny],
      ['practice', trainedModel(), tiny],
      ['ranked', emptyModel(), DEFAULT_SETTINGS],
    ] as const) {
      const qs = sequence(mode, model, settings, 3, 3000);
      for (let i = 1; i < qs.length; i++) expect(sameQuestion(qs[i - 1], qs[i])).toBe(false);
    }
  });
});
