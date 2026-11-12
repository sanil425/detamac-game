import { describe, expect, it } from 'vitest';
import { TYPING_MIN_SAMPLES } from './config';
import { createRng } from './rng';
import { addTypingSample, adjustMs, emptyTypingFit, fitLine, typingReady, typingSlope } from './typing';

describe('typing fit', () => {
  it('recovers a known a and b from synthetic data', () => {
    const fit = emptyTypingFit();
    const rng = createRng(11);
    for (let i = 0; i < 2000; i++) {
      const digits = 1 + Math.floor(rng() * 4);
      const noise = (rng() - 0.5) * 200; // ±100 ms
      addTypingSample(fit, digits, 800 + 250 * digits + noise);
    }
    const line = fitLine(fit)!;
    expect(line.a).toBeCloseTo(800, -1); // within ~5 ms
    expect(line.b).toBeCloseTo(250, -1);
  });

  it('is not applied before TYPING_MIN_SAMPLES answers', () => {
    const fit = emptyTypingFit();
    for (let i = 0; i < TYPING_MIN_SAMPLES - 1; i++) addTypingSample(fit, 1 + (i % 2), 1000 + 300 * (1 + (i % 2)));
    expect(typingSlope(fit)).toBe(0);
    addTypingSample(fit, 2, 1600);
    expect(typingSlope(fit)).toBeCloseTo(300);
    expect(adjustMs(fit, 2000, 2)).toBeCloseTo(1400);
  });

  it('is not applied when every answer has the same length', () => {
    const fit = emptyTypingFit();
    for (let i = 0; i < 100; i++) addTypingSample(fit, 2, 1000 + i);
    expect(typingSlope(fit)).toBe(0);
  });

  it('is not applied when lopsided: 2 lengths seen but only one has 5+ answers', () => {
    const fit = emptyTypingFit();
    for (let i = 0; i < 40; i++) addTypingSample(fit, 2, 1600);
    for (let i = 0; i < 4; i++) addTypingSample(fit, 3, 1900);
    expect(fit.n).toBeGreaterThanOrEqual(TYPING_MIN_SAMPLES);
    expect(fitLine(fit)!.b).toBeCloseTo(300); // the line exists...
    expect(typingReady(fit)).toBe(false); // ...but isn't trusted yet
    expect(typingSlope(fit)).toBe(0);
    addTypingSample(fit, 3, 1900); // 5th 3-digit answer
    expect(typingReady(fit)).toBe(true);
    expect(typingSlope(fit)).toBeCloseTo(300);
  });

  it('clamps a negative slope to 0', () => {
    const fit = emptyTypingFit();
    for (let i = 0; i < 60; i++) addTypingSample(fit, 1 + (i % 3), 3000 - 400 * (1 + (i % 3)));
    expect(fitLine(fit)!.b).toBeLessThan(0);
    expect(typingSlope(fit)).toBe(0);
  });
});
