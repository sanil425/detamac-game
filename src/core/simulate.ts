import type { Settings } from './config';
import { DEFAULT_SETTINGS, WARMUP_ANSWERS } from './config';
import type { Question } from './generator';
import { groupId } from './groups';
import type { ModelState } from './model';
import { emptyModel, makeRecord, recordAnswer } from './model';
import type { Rng } from './rng';
import { createRng } from './rng';
import { nextQuestion } from './sampler';
import type { RankedEntry, SaveData } from './storage';
import { defaultSaveData } from './storage';

// A made-up player with known weaknesses, used by the simulation test and the dev demo data.
//   time = (2000 ms × 2 on ×7 multiplication × 1.5 on division + 300 ms per answer digit) × (1 ± 10% noise)
export const SIM_BASE_MS = 2000;
export const SIM_MS_PER_DIGIT = 300;
export const SIM_NOISE = 0.1;
const QUESTIONS_PER_ROUND = 50;

export function simulatedAnswerMs(q: Question, rng: Rng): number {
  let base = SIM_BASE_MS;
  if (groupId(q).startsWith('mul:7:')) base *= 2;
  if (q.op === 'division') base *= 1.5;
  const digits = String(Math.abs(q.answer)).length;
  const noise = 1 + (rng() * 2 - 1) * SIM_NOISE;
  return (base + SIM_MS_PER_DIGIT * digits) * noise;
}

export interface SimulatedQuestion {
  question: Question;
  afterWarmup: boolean; // true if the model was past warm-up when this question was chosen
}

export interface SimulationResult {
  model: ModelState;
  questions: SimulatedQuestion[];
}

// Play `count` practice questions in rounds of 50, feeding every answer into the model.
export function simulatePractice(count: number, seed: number, settings: Settings = DEFAULT_SETTINGS): SimulationResult {
  const model = emptyModel();
  const pickRng = createRng(seed);
  const timeRng = createRng(seed + 1);
  const questions: SimulatedQuestion[] = [];
  let previous: Question | null = null;
  let timestamp = 0;

  for (let i = 0; i < count; i++) {
    const afterWarmup = model.totalAnswers >= WARMUP_ANSWERS;
    const q = nextQuestion({ mode: 'practice', settings, model, rng: pickRng, previous });
    const ms = simulatedAnswerMs(q, timeRng);
    timestamp += ms;
    recordAnswer(model, makeRecord(q, ms, 'practice', timestamp), i % QUESTIONS_PER_ROUND === 0);
    questions.push({ question: q, afterWarmup });
    previous = q;
  }
  return { model, questions };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Demo save data: the simulated player's model plus 15 ranked rounds over the past
// three weeks with scores trending upward.
export function buildDemoData(now: number): SaveData {
  const data = defaultSaveData();
  const sim = simulatePractice(3000, 7);
  data.model = sim.model;

  const rng = createRng(99);
  const rounds = 15;
  const history: RankedEntry[] = [];
  for (let i = 0; i < rounds; i++) {
    const daysAgo = 21 - (i * 21) / rounds;
    const trend = 28 + i * 1.6;
    const score = Math.round(trend + (rng() * 2 - 1) * 4);
    history.push({ date: new Date(now - daysAgo * DAY_MS).toISOString(), score });
  }
  data.rankedHistory = history;
  return data;
}
