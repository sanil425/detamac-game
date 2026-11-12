import type { Mode, Operation, Settings } from './config';
import {
  DEFAULT_SETTINGS,
  EXPLORE_WEIGHT,
  MAX_GROUP_TRIES,
  MAX_REPEAT_TRIES,
  MIN_ATTEMPTS,
  TARGETED_FRACTION,
  WARMUP_ANSWERS,
} from './config';
import type { Question } from './generator';
import { enabledOperations, randomQuestion, sameQuestion, uniformQuestion } from './generator';
import { eligibleGroups, groupId } from './groups';
import type { ModelState } from './model';
import { weakness } from './model';
import type { Rng } from './rng';
import { weightedIndex } from './rng';

// Step 1: how often each enabled operation is picked.
//   u = 1/k for k enabled operations
//   timeShare = op EWMA / sum of op EWMAs   (slower operations get a bigger share)
//   share = ½·u + ½·timeShare, kept within [½u, 2u]
// Because timeShare ≥ 0, the blend is always ≥ ½u, so only the upper clamp can bite.
// Capped shares are fixed at 2u and the leftover is spread over the others in proportion,
// repeating until nothing is above the cap. The result always sums to 1.
export function operationShares(ops: Operation[], model: ModelState): Record<string, number> {
  const k = ops.length;
  const shares: Record<string, number> = {};
  if (k === 0) return shares;
  const u = 1 / k;

  // Operations with no data yet borrow the average EWMA of those that have data.
  const known = ops.map((op) => model.operations[op]?.fast).filter((x): x is number => x !== undefined && x > 0);
  const fallback = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  const ewma = ops.map((op) => {
    const v = model.operations[op]?.fast;
    return v !== undefined && v > 0 ? v : fallback;
  });
  const total = ewma.reduce((a, b) => a + b, 0);
  ops.forEach((op, i) => (shares[op] = 0.5 * u + 0.5 * (ewma[i] / total)));

  const hi = 2 * u;
  const capped = new Set<string>();
  for (let iter = 0; iter < k; iter++) {
    for (const op of ops) if (shares[op] > hi) capped.add(op);
    const free = ops.filter((op) => !capped.has(op));
    const remaining = 1 - capped.size * hi;
    const freeSum = free.reduce((s, op) => s + shares[op], 0);
    for (const op of capped) shares[op] = hi;
    for (const op of free) shares[op] = (shares[op] / freeSum) * remaining;
    if (!free.some((op) => shares[op] > hi)) break;
  }
  return shares;
}

// Step 2 weights: weakness for groups with enough data, EXPLORE_WEIGHT for new ones.
export function groupWeights(groups: string[], model: ModelState): number[] {
  return groups.map((id) => {
    const s = model.groups[id];
    if (!s || s.count < MIN_ATTEMPTS) return EXPLORE_WEIGHT;
    return weakness(model, id) ?? EXPLORE_WEIGHT;
  });
}

// Rejection sampling: draw random questions until one lands in the group.
export function questionInGroup(op: Operation, group: string, settings: Settings, rng: Rng): Question {
  for (let i = 0; i < MAX_GROUP_TRIES; i++) {
    const q = randomQuestion(op, settings, rng);
    if (groupId(q) === group) return q;
  }
  return randomQuestion(op, settings, rng);
}

function adaptiveQuestion(settings: Settings, model: ModelState, rng: Rng): Question {
  if (model.totalAnswers < WARMUP_ANSWERS) return uniformQuestion(settings, rng);

  const ops = enabledOperations(settings);
  if (ops.length === 0) return uniformQuestion(settings, rng);
  const shares = operationShares(ops, model);
  const op = ops[weightedIndex(rng, ops.map((o) => shares[o]))];

  if (rng() < TARGETED_FRACTION) {
    const groups = eligibleGroups(op, settings);
    if (groups.length > 0) {
      const group = groups[weightedIndex(rng, groupWeights(groups, model))];
      return questionInGroup(op, group, settings, rng);
    }
  }
  return randomQuestion(op, settings, rng);
}

export interface NextQuestionInput {
  mode: Mode;
  settings: Settings; // ignored in ranked mode
  model: ModelState; // ignored in ranked mode
  rng: Rng;
  previous: Question | null;
}

// The single entry point the game uses to get its next question.
export function nextQuestion(input: NextQuestionInput): Question {
  const { mode, settings, model, rng, previous } = input;
  // Ranked is pure uniform random over the default settings; the model is never consulted.
  const draw = () =>
    mode === 'ranked' ? uniformQuestion(DEFAULT_SETTINGS, rng) : adaptiveQuestion(settings, model, rng);

  let q = draw();
  // Never repeat the previous question. The cap only matters for ranges with one possible question.
  for (let i = 0; i < MAX_REPEAT_TRIES && sameQuestion(previous, q); i++) q = draw();
  return q;
}
