import type { Mode, Operation } from './config';
import {
  EWMA_ALPHA,
  EWMA_ALPHA_SLOW,
  MIN_ATTEMPTS,
  OUTLIER_MS,
  PRACTICE_WEIGHT,
  TREND_THRESHOLD,
} from './config';
import type { Question } from './generator';
import { factId, groupId, operationOfGroup } from './groups';
import type { TypingFit } from './typing';
import { addTypingSample, adjustMs, emptyTypingFit } from './typing';

export interface AnswerRecord {
  operation: Operation;
  groupId: string;
  factId?: string;
  ms: number;
  answerDigits: number;
  mode: Mode;
  timestamp: number;
}

// Running statistics for one group, fact or operation.
export interface Stat {
  fast: number; // EWMA of adjusted ms (alpha = EWMA_ALPHA × weight)
  slow: number; // slower EWMA of adjusted ms, for the trend
  count: number; // attempts counted
  lastSeen: number; // timestamp of the last counted attempt
}

export interface ModelState {
  groups: Record<string, Stat>;
  facts: Record<string, Stat>;
  operations: Record<string, Stat>;
  typing: TypingFit;
  totalAnswers: number; // answers that passed the filters
}

export type Trend = 'improving' | 'worsening' | 'flat';

export function emptyModel(): ModelState {
  return { groups: {}, facts: {}, operations: {}, typing: emptyTypingFit(), totalAnswers: 0 };
}

export function makeRecord(q: Question, ms: number, mode: Mode, timestamp: number): AnswerRecord {
  return {
    operation: q.op,
    groupId: groupId(q),
    factId: factId(q),
    ms,
    answerDigits: String(Math.abs(q.answer)).length,
    mode,
    timestamp,
  };
}

export function modeWeight(mode: Mode): number {
  return mode === 'ranked' ? 1 : PRACTICE_WEIGHT;
}

// Exponentially weighted moving average: new = old + alpha·(x − old).
// A bigger alpha reacts faster to new answers. Weight scales alpha, so a practice
// answer (weight 0.5) moves the average half as far as a ranked one.
function updateStat(stats: Record<string, Stat>, key: string, x: number, weight: number, now: number): void {
  const s = stats[key];
  if (!s) {
    // The first answer simply becomes the average.
    stats[key] = { fast: x, slow: x, count: 1, lastSeen: now };
    return;
  }
  s.fast += EWMA_ALPHA * weight * (x - s.fast);
  s.slow += EWMA_ALPHA_SLOW * weight * (x - s.slow);
  s.count += 1;
  s.lastSeen = now;
}

// Feed one answer into the model. Returns false if the answer was filtered out.
export function recordAnswer(model: ModelState, rec: AnswerRecord, isFirstInRound: boolean): boolean {
  // The first question of a round includes reaction/settling time; very slow answers are distractions.
  if (isFirstInRound || rec.ms > OUTLIER_MS) return false;

  // Correct using the fit from earlier answers, then add this answer to the fit.
  const adjusted = adjustMs(model.typing, rec.ms, rec.answerDigits);
  addTypingSample(model.typing, rec.operation, rec.answerDigits, rec.ms);

  const weight = modeWeight(rec.mode);
  updateStat(model.groups, rec.groupId, adjusted, weight, rec.timestamp);
  if (rec.factId) updateStat(model.facts, rec.factId, adjusted, weight, rec.timestamp);
  updateStat(model.operations, rec.operation, adjusted, weight, rec.timestamp);
  model.totalAnswers += 1;
  return true;
}

// Feed a whole round at once (index 0 is the round's first question).
export function recordRound(model: ModelState, records: AnswerRecord[]): void {
  records.forEach((rec, i) => recordAnswer(model, rec, i === 0));
}

// Ranked answers are held until the round ends (ranked questions never read the model,
// so nothing is lost by waiting). A completed round counts as ranked; a round that was
// quit, closed or hidden counts as practice, i.e. at PRACTICE_WEIGHT.
export function applyRankedRound(model: ModelState, records: AnswerRecord[], completed: boolean): void {
  const mode: Mode = completed ? 'ranked' : 'practice';
  recordRound(
    model,
    records.map((r) => ({ ...r, mode })),
  );
}

// Weakness compares a group to its own operation, so slow-but-normal operations
// (division is usually slower than addition) don't swamp everything else.
// 1.8 means "80% slower than your usual speed for this operation".
export function weakness(model: ModelState, id: string): number | null {
  const g = model.groups[id];
  const op = model.operations[operationOfGroup(id)];
  if (!g || !op || op.fast <= 0) return null;
  return g.fast / op.fast;
}

// Fact speed relative to overall multiplication speed (for the heatmap).
export function factRatio(model: ModelState, id: string): number | null {
  const f = model.facts[id];
  const op = model.operations.multiplication;
  if (!f || !op || op.fast <= 0) return null;
  return f.fast / op.fast;
}

// Fast EWMA below the slow one means recent answers are quicker than the long-run average.
export function trend(s: Stat): Trend {
  if (s.fast < s.slow * (1 - TREND_THRESHOLD)) return 'improving';
  if (s.fast > s.slow * (1 + TREND_THRESHOLD)) return 'worsening';
  return 'flat';
}

export interface WeakGroup {
  id: string;
  weakness: number;
  trend: Trend;
}

// Groups with enough data, weakest first.
export function weakestGroups(model: ModelState, limit: number): WeakGroup[] {
  const list: WeakGroup[] = [];
  for (const id of Object.keys(model.groups)) {
    const s = model.groups[id];
    const w = weakness(model, id);
    if (w !== null && s.count >= MIN_ATTEMPTS) list.push({ id, weakness: w, trend: trend(s) });
  }
  list.sort((a, b) => b.weakness - a.weakness);
  return list.slice(0, limit);
}
