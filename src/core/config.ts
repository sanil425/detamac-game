// Every tunable constant and the shared basic types live here.

export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division';
export type Mode = 'ranked' | 'practice';

export const OPERATIONS: Operation[] = ['addition', 'subtraction', 'multiplication', 'division'];

export interface Range {
  min: number;
  max: number;
}

export interface Settings {
  addition: boolean;
  subtraction: boolean;
  multiplication: boolean;
  division: boolean;
  // Addition ranges; subtraction reuses them in reverse.
  addLeft: Range;
  addRight: Range;
  // Multiplication ranges; division reuses them in reverse.
  mulLeft: Range;
  mulRight: Range;
  durationSeconds: number;
}

// Durations the player can choose from.
export const DURATIONS = [30, 60, 120, 300, 600];
export const RANKED_DURATION = 120;

export const DEFAULT_SETTINGS: Settings = {
  addition: true,
  subtraction: true,
  multiplication: true,
  division: true,
  addLeft: { min: 2, max: 100 },
  addRight: { min: 2, max: 100 },
  mulLeft: { min: 2, max: 12 },
  mulRight: { min: 2, max: 100 },
  durationSeconds: RANKED_DURATION,
};

// --- Model ---
// Practice answers move the averages half as much as ranked answers.
export const PRACTICE_WEIGHT = 0.5;
// Answers slower than this are treated as distractions and ignored.
export const OUTLIER_MS = 15000;
// Typing correction turns on only after this many answers...
export const TYPING_MIN_SAMPLES = 30;
// ...and at least two digit lengths must each have this many answers.
export const TYPING_MIN_PER_LENGTH = 5;
// Fast EWMA: each new answer moves the average 20% of the way toward it.
export const EWMA_ALPHA = 0.2;
// Slow EWMA, used only to judge the trend.
export const EWMA_ALPHA_SLOW = 0.05;
// Fast EWMA must differ from slow EWMA by more than this fraction to show an up/down trend.
export const TREND_THRESHOLD = 0.05;

// --- Sampler ---
export const WARMUP_ANSWERS = 100;
export const TARGETED_FRACTION = 0.65;
export const MIN_ATTEMPTS = 5;
export const EXPLORE_WEIGHT = 1.5;
// Rejection-sampling tries when generating a question inside a chosen group.
export const MAX_GROUP_TRIES = 2000;
// Tries to avoid showing the same question twice in a row.
export const MAX_REPEAT_TRIES = 50;

// --- Groups ---
// Multiplication facts cover both operands in this range.
export const FACT_MIN = 2;
export const FACT_MAX = 12;
// Small factors above this share one group ("21+").
export const SMALL_FACTOR_CAP = 20;
// Above this many operand pairs, eligible groups are found by sampling instead of a full scan.
export const ENUMERATION_LIMIT = 40000;
export const ENUMERATION_SAMPLES = 20000;

// --- Storage ---
export const STORAGE_KEY = 'detamac:v1';
export const SCHEMA_VERSION = 1;
