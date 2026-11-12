import type { Operation, Settings } from './config';
import {
  ENUMERATION_LIMIT,
  ENUMERATION_SAMPLES,
  FACT_MAX,
  FACT_MIN,
  SMALL_FACTOR_CAP,
} from './config';
import type { Question } from './generator';
import { makeQuestion, rangesFor } from './generator';
import { createRng, randInt } from './rng';

// Group ids are plain strings such as:
//   "add:carry:2+2:le100"   "sub:borrow:gt100"   "mul:7:le12"   "div:21+:gt12"

function digitCount(n: number): number {
  return String(Math.abs(n)).length;
}

function onesDigit(n: number): number {
  return Math.abs(n) % 10;
}

// Small factors above SMALL_FACTOR_CAP share the "21+" bucket.
function factorLabel(n: number): string {
  return n > SMALL_FACTOR_CAP ? `${SMALL_FACTOR_CAP + 1}+` : String(n);
}

export function groupId(q: Question): string {
  switch (q.op) {
    case 'addition': {
      const carry = onesDigit(q.left) + onesDigit(q.right) >= 10 ? 'carry' : 'nocarry';
      const d1 = digitCount(q.left);
      const d2 = digitCount(q.right);
      const pattern = d1 >= 3 || d2 >= 3 ? '3+' : `${Math.min(d1, d2)}+${Math.max(d1, d2)}`;
      const size = q.answer <= 100 ? 'le100' : 'gt100';
      return `add:${carry}:${pattern}:${size}`;
    }
    case 'subtraction': {
      const borrow = onesDigit(q.left) < onesDigit(q.right) ? 'borrow' : 'noborrow';
      const size = q.left <= 100 ? 'le100' : 'gt100';
      return `sub:${borrow}:${size}`;
    }
    case 'multiplication': {
      // The small factor is the smaller operand, so 7×8 and 8×7 land in the same group.
      const small = Math.min(q.left, q.right);
      const other = Math.max(q.left, q.right);
      return `mul:${factorLabel(small)}:${other <= 12 ? 'le12' : 'gt12'}`;
    }
    case 'division':
      // The divisor is the operand drawn from the first range.
      return `div:${factorLabel(q.right)}:${q.answer <= 12 ? 'le12' : 'gt12'}`;
  }
}

// Fact id for multiplications with both operands in 2–12, order-independent: "7x8".
export function factId(q: Question): string | undefined {
  if (q.op !== 'multiplication') return undefined;
  const small = Math.min(q.left, q.right);
  const big = Math.max(q.left, q.right);
  if (small < FACT_MIN || big > FACT_MAX) return undefined;
  return `${small}x${big}`;
}

export function operationOfGroup(id: string): Operation {
  const prefix = id.split(':')[0];
  if (prefix === 'add') return 'addition';
  if (prefix === 'sub') return 'subtraction';
  if (prefix === 'mul') return 'multiplication';
  return 'division';
}

// Human-readable group name for the stats page.
export function groupLabel(id: string): string {
  const parts = id.split(':');
  switch (parts[0]) {
    case 'add': {
      const carry = parts[1] === 'carry' ? 'with carry' : 'no carry';
      const pattern = parts[2] === '3+' ? '3+ digits' : `${parts[2]} digits`;
      const size = parts[3] === 'le100' ? 'sum ≤ 100' : 'sum > 100';
      return `Addition, ${pattern}, ${carry}, ${size}`;
    }
    case 'sub': {
      const borrow = parts[1] === 'borrow' ? 'with borrow' : 'no borrow';
      const size = parts[2] === 'le100' ? 'from ≤ 100' : 'from > 100';
      return `Subtraction, ${borrow}, ${size}`;
    }
    case 'mul':
      return `Multiplication ×${parts[1]}, other factor ${parts[2] === 'le12' ? '≤ 12' : '> 12'}`;
    default:
      return `Division ÷${parts[1]}, answer ${parts[2] === 'le12' ? '≤ 12' : '> 12'}`;
  }
}

// Groups the current ranges can actually produce. Small range combinations are scanned
// completely; big ones are sampled with a fixed seed. Results are cached per range setting.
const eligibleCache = new Map<string, string[]>();

export function eligibleGroups(op: Operation, settings: Settings): string[] {
  const [r1, r2] = rangesFor(op, settings);
  const key = `${op}|${r1.min}|${r1.max}|${r2.min}|${r2.max}`;
  const cached = eligibleCache.get(key);
  if (cached) return cached;

  const lo1 = Math.min(r1.min, r1.max);
  const hi1 = Math.max(r1.min, r1.max);
  const lo2 = Math.min(r2.min, r2.max);
  const hi2 = Math.max(r2.min, r2.max);
  // Operand order doesn't affect the group, so a constant rng is fine here.
  const noShuffle = () => 0;
  const found = new Set<string>();

  if ((hi1 - lo1 + 1) * (hi2 - lo2 + 1) <= ENUMERATION_LIMIT) {
    for (let x = lo1; x <= hi1; x++) {
      for (let y = lo2; y <= hi2; y++) found.add(groupId(makeQuestion(op, x, y, noShuffle)));
    }
  } else {
    const rng = createRng(12345);
    for (let i = 0; i < ENUMERATION_SAMPLES; i++) {
      const q = makeQuestion(op, randInt(rng, lo1, hi1), randInt(rng, lo2, hi2), noShuffle);
      found.add(groupId(q));
    }
  }

  const result = [...found].sort();
  eligibleCache.set(key, result);
  return result;
}
