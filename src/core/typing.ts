import { TYPING_MIN_SAMPLES } from './config';

// Longer answers take longer to type, which has nothing to do with arithmetic skill.
// We fit a straight line  ms ≈ a + b·digits  across all answers by least squares, and
// subtract b·digits from each time. Only five running sums are stored, never raw answers.
export interface TypingFit {
  n: number; // number of samples
  sumX: number; // Σ digits
  sumY: number; // Σ ms
  sumXX: number; // Σ digits²
  sumXY: number; // Σ digits·ms
}

export function emptyTypingFit(): TypingFit {
  return { n: 0, sumX: 0, sumY: 0, sumXX: 0, sumXY: 0 };
}

export function addTypingSample(fit: TypingFit, digits: number, ms: number): void {
  fit.n += 1;
  fit.sumX += digits;
  fit.sumY += ms;
  fit.sumXX += digits * digits;
  fit.sumXY += digits * ms;
}

// Standard least-squares solution from the running sums:
//   b = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²),   a = (Σy − b·Σx) / n
// The denominator is n² × variance of digits; it is 0 when every answer had the same
// length, which is why we need at least two digit lengths before trusting b.
export function fitLine(fit: TypingFit): { a: number; b: number } | null {
  const denom = fit.n * fit.sumXX - fit.sumX * fit.sumX;
  if (fit.n === 0 || denom <= 0) return null;
  const b = (fit.n * fit.sumXY - fit.sumX * fit.sumY) / denom;
  const a = (fit.sumY - b * fit.sumX) / fit.n;
  return { a, b };
}

// Per-digit typing cost to subtract, or 0 while the fit isn't ready yet.
export function typingSlope(fit: TypingFit): number {
  if (fit.n < TYPING_MIN_SAMPLES) return 0;
  const line = fitLine(fit);
  if (!line) return 0;
  return Math.max(0, line.b); // a negative slope would mean longer answers are faster; ignore it
}

export function adjustMs(fit: TypingFit, ms: number, digits: number): number {
  return ms - typingSlope(fit) * digits;
}
