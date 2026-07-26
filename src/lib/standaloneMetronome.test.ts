import { describe, expect, it } from 'vitest';
import { isBarAudible, shouldResynchronize } from './standaloneMetronome';

describe('standalone metronome recovery', () => {
  it('resynchronizes when the scheduler is far behind the audio clock', () => {
    expect(shouldResynchronize(4.7, 5)).toBe(true);
  });

  it('resynchronizes when a stale schedule is unrealistically far ahead', () => {
    expect(shouldResynchronize(7.1, 5)).toBe(true);
  });

  it('keeps a healthy near-future schedule', () => {
    expect(shouldResynchronize(5.08, 5)).toBe(false);
  });
});

describe('gap click bars', () => {
  it('keeps all bars audible when gap click is disabled', () => {
    expect(isBarAudible(9, false, 4, 2)).toBe(true);
  });

  it('plays four bars and mutes the following two bars', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((bar) => isBarAudible(bar, true, 4, 2))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      true,
    ]);
  });
});
