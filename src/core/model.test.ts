import { describe, expect, it } from 'vitest';
import { EWMA_ALPHA, OUTLIER_MS, PRACTICE_WEIGHT } from './config';
import type { Question } from './generator';
import { emptyModel, makeRecord, recordAnswer, recordRound, trend, weakestGroups, weakness } from './model';

const q78: Question = { op: 'multiplication', left: 7, right: 8, answer: 56 };
const q87: Question = { op: 'multiplication', left: 8, right: 7, answer: 56 };
const q99: Question = { op: 'multiplication', left: 9, right: 9, answer: 81 };

describe('model', () => {
  it('builds answer records with group, fact and digits', () => {
    const r = makeRecord(q78, 1200, 'ranked', 5);
    expect(r).toEqual({
      operation: 'multiplication',
      groupId: 'mul:7:le12',
      factId: '7x8',
      ms: 1200,
      answerDigits: 2,
      mode: 'ranked',
      timestamp: 5,
    });
  });

  it('excludes first-of-round and outlier answers', () => {
    const m = emptyModel();
    expect(recordAnswer(m, makeRecord(q78, 1000, 'ranked', 1), true)).toBe(false);
    expect(recordAnswer(m, makeRecord(q78, OUTLIER_MS + 1, 'ranked', 2), false)).toBe(false);
    expect(m.totalAnswers).toBe(0);
    expect(m.groups).toEqual({});
    expect(recordAnswer(m, makeRecord(q78, OUTLIER_MS, 'ranked', 3), false)).toBe(true);
    expect(m.totalAnswers).toBe(1);
  });

  it('recordRound skips only the first record of the round', () => {
    const m = emptyModel();
    recordRound(m, [makeRecord(q78, 9000, 'ranked', 1), makeRecord(q78, 1000, 'ranked', 2)]);
    expect(m.totalAnswers).toBe(1);
    expect(m.groups['mul:7:le12'].fast).toBe(1000);
  });

  it('7×8 and 8×7 update the same fact', () => {
    const m = emptyModel();
    recordAnswer(m, makeRecord(q78, 1000, 'ranked', 1), false);
    recordAnswer(m, makeRecord(q87, 2000, 'ranked', 2), false);
    expect(Object.keys(m.facts)).toEqual(['7x8']);
    expect(m.facts['7x8'].count).toBe(2);
  });

  it('practice weight halves the update', () => {
    const ranked = emptyModel();
    const practice = emptyModel();
    for (const m of [ranked, practice]) recordAnswer(m, makeRecord(q78, 1000, 'ranked', 1), false);
    recordAnswer(ranked, makeRecord(q78, 2000, 'ranked', 2), false);
    recordAnswer(practice, makeRecord(q78, 2000, 'practice', 2), false);
    const rankedMove = ranked.groups['mul:7:le12'].fast - 1000;
    const practiceMove = practice.groups['mul:7:le12'].fast - 1000;
    expect(rankedMove).toBeCloseTo(EWMA_ALPHA * 1000);
    expect(practiceMove).toBeCloseTo(rankedMove * PRACTICE_WEIGHT);
    // Same for the slow EWMA and the operation EWMA.
    expect(practice.groups['mul:7:le12'].slow - 1000).toBeCloseTo((ranked.groups['mul:7:le12'].slow - 1000) / 2);
    expect(practice.operations.multiplication.fast - 1000).toBeCloseTo(
      (ranked.operations.multiplication.fast - 1000) / 2,
    );
  });

  it('weakness is group EWMA over operation EWMA', () => {
    const m = emptyModel();
    for (let i = 0; i < 10; i++) {
      recordAnswer(m, makeRecord(q78, 3000, 'ranked', i), false);
      recordAnswer(m, makeRecord(q99, 1000, 'ranked', i), false);
    }
    const w78 = weakness(m, 'mul:7:le12')!;
    const w99 = weakness(m, 'mul:9:le12')!;
    expect(w78).toBeGreaterThan(1);
    expect(w99).toBeLessThan(1);
    expect(weakestGroups(m, 5).map((g) => g.id)).toEqual(['mul:7:le12', 'mul:9:le12']);
  });

  it('trend compares fast and slow EWMAs', () => {
    expect(trend({ fast: 800, slow: 1000, count: 10, lastSeen: 0 })).toBe('improving');
    expect(trend({ fast: 1200, slow: 1000, count: 10, lastSeen: 0 })).toBe('worsening');
    expect(trend({ fast: 1010, slow: 1000, count: 10, lastSeen: 0 })).toBe('flat');
  });
});
