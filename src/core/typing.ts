import { TYPING_MIN_PER_LENGTH, TYPING_MIN_SAMPLES } from './config';

// Longer answers take longer to type, which has nothing to do with arithmetic skill.
// We model  ms ≈ a_op + b·digits : every operation gets its own baseline a_op, and all
// operations share one per-digit typing cost b. Each time is then corrected by
// subtracting b·digits.
//
// Why a baseline per operation: operations differ in both speed and answer length
// (division is slow with short answers, multiplication has long answers). One shared
// baseline would mix "this operation is slow" into the per-digit cost and get b wrong.
//
// Only running sums are stored (per operation), plus a count per digit length.
export interface Sums {
  n: number; // number of samples
  sumX: number; // Σ digits
  sumY: number; // Σ ms
  sumXX: number; // Σ digits²
  sumXY: number; // Σ digits·ms
}

export interface TypingFit {
  n: number; // total samples across operations
  byOperation: Record<string, Sums>;
  digitCounts: Record<string, number>; // answers per digit length, e.g. { "2": 40, "3": 6 }
}

export function emptyTypingFit(): TypingFit {
  return { n: 0, byOperation: {}, digitCounts: {} };
}

export function addTypingSample(fit: TypingFit, operation: string, digits: number, ms: number): void {
  const s = fit.byOperation[operation] ?? { n: 0, sumX: 0, sumY: 0, sumXX: 0, sumXY: 0 };
  s.n += 1;
  s.sumX += digits;
  s.sumY += ms;
  s.sumXX += digits * digits;
  s.sumXY += digits * ms;
  fit.byOperation[operation] = s;
  fit.n += 1;
  fit.digitCounts[digits] = (fit.digitCounts[digits] ?? 0) + 1;
}

// Least squares with a separate intercept per operation:
//   within each operation, measure digits and ms relative to that operation's own averages:
//     Sxx = Σx² − (Σx)²/n      Sxy = Σxy − Σx·Σy/n
//   then  b = (sum of Sxy over operations) / (sum of Sxx over operations)
//   and   a_op = (Σy − b·Σx) / n   for each operation.
// Sxx is 0 when every answer in an operation had the same length, so b only means
// something once answers of several lengths have been seen.
export function fitTyping(fit: TypingFit): { b: number; a: Record<string, number> } | null {
  let sxx = 0;
  let sxy = 0;
  for (const s of Object.values(fit.byOperation)) {
    if (s.n === 0) continue;
    sxx += s.sumXX - (s.sumX * s.sumX) / s.n;
    sxy += s.sumXY - (s.sumX * s.sumY) / s.n;
  }
  if (sxx <= 1e-9) return null;
  const b = sxy / sxx;
  const a: Record<string, number> = {};
  for (const [op, s] of Object.entries(fit.byOperation)) {
    if (s.n > 0) a[op] = (s.sumY - b * s.sumX) / s.n;
  }
  return { b, a };
}

// The fit is trusted once there are enough answers overall AND at least two digit
// lengths each have enough answers (a handful of 3-digit answers among hundreds of
// 2-digit ones would make the slope very noisy).
export function typingReady(fit: TypingFit): boolean {
  if (fit.n < TYPING_MIN_SAMPLES) return false;
  const wellCovered = Object.values(fit.digitCounts).filter((c) => c >= TYPING_MIN_PER_LENGTH);
  return wellCovered.length >= 2;
}

// Per-digit typing cost to subtract, or 0 while the fit isn't ready yet.
export function typingSlope(fit: TypingFit): number {
  if (!typingReady(fit)) return 0;
  const line = fitTyping(fit);
  if (!line) return 0;
  return Math.max(0, line.b); // a negative slope would mean longer answers are faster; ignore it
}

export function adjustMs(fit: TypingFit, ms: number, digits: number): number {
  return ms - typingSlope(fit) * digits;
}
