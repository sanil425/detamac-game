import type { Operation, Range, Settings } from './config';
import { OPERATIONS } from './config';
import type { Rng } from './rng';
import { randInt } from './rng';

// A question as shown on screen: "left <symbol> right = answer".
export interface Question {
  op: Operation;
  left: number;
  right: number;
  answer: number;
}

export const SYMBOLS: Record<Operation, string> = {
  addition: '+',
  subtraction: '–',
  multiplication: '×',
  division: '÷',
};

export function questionText(q: Question): string {
  return `${q.left} ${SYMBOLS[q.op]} ${q.right}`;
}

export function sameQuestion(a: Question | null, b: Question): boolean {
  return a !== null && a.op === b.op && a.left === b.left && a.right === b.right;
}

export function enabledOperations(settings: Settings): Operation[] {
  return OPERATIONS.filter((op) => settings[op]);
}

// The two ranges an operation draws from.
export function rangesFor(op: Operation, settings: Settings): [Range, Range] {
  return op === 'addition' || op === 'subtraction'
    ? [settings.addLeft, settings.addRight]
    : [settings.mulLeft, settings.mulRight];
}

// Build a question from x (drawn from the first range) and y (drawn from the second).
// Subtraction and division are addition and multiplication in reverse:
//   (x + y) − x = y      (x × y) ÷ x = y
export function makeQuestion(op: Operation, x: number, y: number, rng: Rng): Question {
  switch (op) {
    case 'addition':
      return { op, left: x, right: y, answer: x + y };
    case 'subtraction':
      return { op, left: x + y, right: x, answer: y };
    case 'multiplication':
      // Operand order on screen is random; 7×8 and 8×7 are the same fact.
      return rng() < 0.5
        ? { op, left: x, right: y, answer: x * y }
        : { op, left: y, right: x, answer: x * y };
    case 'division':
      return { op, left: x * y, right: x, answer: y };
  }
}

// A plain uniform random question for one operation.
export function randomQuestion(op: Operation, settings: Settings, rng: Rng): Question {
  const [r1, r2] = rangesFor(op, settings);
  const x = randInt(rng, r1.min, r1.max);
  const y = randInt(rng, r2.min, r2.max);
  return makeQuestion(op, x, y, rng);
}

// Uniform over enabled operations, then uniform within ranges.
export function uniformQuestion(settings: Settings, rng: Rng): Question {
  const ops = enabledOperations(settings);
  const choices: Operation[] = ops.length > 0 ? ops : ['addition'];
  const op = choices[Math.floor(rng() * choices.length)];
  return randomQuestion(op, settings, rng);
}
