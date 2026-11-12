import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, OPERATIONS } from './config';
import { enabledOperations } from './generator';
import { groupId, groupLabel } from './groups';
import { weakestGroups } from './model';
import { operationShares } from './sampler';
import { buildDemoData, SIM_MS_PER_DIGIT, simulatePractice } from './simulate';
import { fitTyping } from './typing';

describe('simulated player (3000 practice questions, default settings)', () => {
  const { model, questions } = simulatePractice(3000, 2024);
  const adaptive = questions.filter((q) => q.afterWarmup).map((q) => q.question);

  const observed: Record<string, number> = {};
  for (const op of OPERATIONS) observed[op] = adaptive.filter((q) => q.op === op).length / adaptive.length;
  const shares = operationShares(enabledOperations(DEFAULT_SETTINGS), model);
  const weakest = weakestGroups(model, 5);

  console.log(
    [
      `Questions after warm-up: ${adaptive.length}`,
      'Operation shares (model target / observed after warm-up):',
      ...OPERATIONS.map((op) => `  ${op.padEnd(15)} ${(shares[op] * 100).toFixed(1)}% / ${(observed[op] * 100).toFixed(1)}%`),
      `Typing fit slope: ${fitTyping(model.typing)!.b.toFixed(1)} ms/digit`,
      'Top 5 weakest groups:',
      ...weakest.map((g, i) => `  ${i + 1}. ${groupLabel(g.id)}: ${g.weakness.toFixed(2)}×`),
    ].join('\n'),
  );

  it('gives division more than 25% of questions, but no more than the 2u cap', () => {
    const cap = 2 / enabledOperations(DEFAULT_SETTINGS).length;
    expect(observed.division).toBeGreaterThan(0.25);
    expect(observed.division).toBeLessThanOrEqual(cap);
    expect(shares.division).toBeGreaterThan(0.25);
    expect(shares.division).toBeLessThanOrEqual(cap);
  });

  it('asks ×7 questions more often than ×3 questions', () => {
    const count = (prefix: string) => adaptive.filter((q) => groupId(q).startsWith(prefix)).length;
    expect(count('mul:7:')).toBeGreaterThan(count('mul:3:'));
  });

  it('recovers the typing cost of ~300 ms per digit (±20%)', () => {
    const b = fitTyping(model.typing)!.b;
    expect(b).toBeGreaterThan(SIM_MS_PER_DIGIT * 0.8);
    expect(b).toBeLessThan(SIM_MS_PER_DIGIT * 1.2);
  });

  it('ranks the ×7 groups in the top 3 weakest', () => {
    const top3 = weakestGroups(model, 3).map((g) => g.id);
    const sevens = Object.keys(model.groups).filter((id) => id.startsWith('mul:7:'));
    expect(sevens.length).toBeGreaterThan(0);
    for (const id of sevens) expect(top3).toContain(id);
  });

  it('builds demo data with ~15 ranked rounds trending upward', () => {
    const now = Date.UTC(2026, 10, 12);
    const demo = buildDemoData(now);
    expect(demo.rankedHistory.length).toBe(15);
    const scores = demo.rankedHistory.map((h) => h.score);
    const firstFive = scores.slice(0, 5).reduce((a, b) => a + b, 0);
    const lastFive = scores.slice(-5).reduce((a, b) => a + b, 0);
    expect(lastFive).toBeGreaterThan(firstFive);
    for (const h of demo.rankedHistory) expect(Date.parse(h.date)).toBeLessThanOrEqual(now);
    expect(demo.model.totalAnswers).toBeGreaterThan(2900);
  });
});
