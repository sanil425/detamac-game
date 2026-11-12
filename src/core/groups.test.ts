import { describe, expect, it } from 'vitest';
import type { Settings } from './config';
import { DEFAULT_SETTINGS } from './config';
import type { Question } from './generator';
import { eligibleGroups, factId, groupId, groupLabel } from './groups';

const q = (op: Question['op'], left: number, right: number, answer: number): Question => ({ op, left, right, answer });

describe('groups', () => {
  it('27 + 38 → carry, 2+2, ≤100', () => {
    expect(groupId(q('addition', 27, 38, 65))).toBe('add:carry:2+2:le100');
  });

  it('addition digit patterns are order-independent and 3+ for big operands', () => {
    expect(groupId(q('addition', 5, 42, 47))).toBe('add:nocarry:1+2:le100');
    expect(groupId(q('addition', 42, 5, 47))).toBe('add:nocarry:1+2:le100');
    expect(groupId(q('addition', 100, 7, 107))).toBe('add:nocarry:3+:gt100');
    expect(groupId(q('addition', 60, 70, 130))).toBe('add:nocarry:2+2:gt100');
  });

  it('143 − 58 → borrow, >100', () => {
    expect(groupId(q('subtraction', 143, 58, 85))).toBe('sub:borrow:gt100');
    expect(groupId(q('subtraction', 58, 23, 35))).toBe('sub:noborrow:le100');
  });

  it('7×8 and 8×7 → same fact and the ×7 / ≤12 group', () => {
    const a = q('multiplication', 7, 8, 56);
    const b = q('multiplication', 8, 7, 56);
    expect(factId(a)).toBe('7x8');
    expect(factId(b)).toBe('7x8');
    expect(groupId(a)).toBe('mul:7:le12');
    expect(groupId(b)).toBe('mul:7:le12');
  });

  it('multiplication: other operand >12, facts only inside 2–12, 21+ bucket', () => {
    expect(groupId(q('multiplication', 45, 7, 315))).toBe('mul:7:gt12');
    expect(factId(q('multiplication', 45, 7, 315))).toBeUndefined();
    expect(groupId(q('multiplication', 25, 30, 750))).toBe('mul:21+:gt12');
    expect(groupId(q('multiplication', 20, 30, 600))).toBe('mul:20:gt12');
  });

  it('division groups by divisor and answer size', () => {
    expect(groupId(q('division', 56, 7, 8))).toBe('div:7:le12');
    expect(groupId(q('division', 315, 7, 45))).toBe('div:7:gt12');
    expect(groupId(q('division', 750, 25, 30))).toBe('div:21+:gt12');
  });

  it('eligible groups for defaults leave out impossible combinations', () => {
    const add = eligibleGroups('addition', DEFAULT_SETTINGS);
    expect(add).toContain('add:carry:2+2:le100');
    expect(add).toContain('add:carry:1+2:gt100'); // 9 + 99
    expect(add).not.toContain('add:nocarry:1+2:gt100'); // impossible
    expect(add).not.toContain('add:carry:1+1:gt100'); // impossible
    const mul = eligibleGroups('multiplication', DEFAULT_SETTINGS);
    expect(mul).toContain('mul:2:le12');
    expect(mul).toContain('mul:12:gt12');
    expect(mul).not.toContain('mul:13:le12');
  });

  it('eligible groups follow custom ranges, including sampled large ones', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, mulLeft: { min: 30, max: 40 }, mulRight: { min: 50, max: 60 } };
    expect(eligibleGroups('multiplication', s)).toEqual(['mul:21+:gt12']);
    const big: Settings = { ...DEFAULT_SETTINGS, addLeft: { min: 1000, max: 9999 }, addRight: { min: 1000, max: 9999 } };
    const groups = eligibleGroups('addition', big);
    expect(groups).toEqual(['add:carry:3+:gt100', 'add:nocarry:3+:gt100']);
  });

  it('has readable labels', () => {
    expect(groupLabel('add:carry:2+2:le100')).toBe('Addition, 2+2 digits, with carry, sum ≤ 100');
    expect(groupLabel('mul:7:le12')).toBe('Multiplication ×7, other factor ≤ 12');
  });
});
