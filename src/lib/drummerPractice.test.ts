import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CUSTOM_PATTERN,
  DEFAULT_ROUTINE,
  GROOVE_PATTERNS,
  clonePattern,
  cycleStepLevel,
  grooveById,
  nextMovingAccentIndex,
  normalizePattern,
  routineTotalBars,
} from './drummerPractice';

describe('drummer practice helpers', () => {
  it('cycles sequencer cells through off, normal and accent', () => {
    expect(cycleStepLevel(0)).toBe(1);
    expect(cycleStepLevel(1)).toBe(2);
    expect(cycleStepLevel(2)).toBe(0);
  });

  it('clones groove patterns without sharing step arrays', () => {
    const source = GROOVE_PATTERNS[0];
    const copy = clonePattern(source);
    copy.steps.kick[0] = 0;
    expect(source.steps.kick[0]).toBe(2);
  });

  it('normalizes invalid stored pattern data to sixteen safe cells', () => {
    const normalized = normalizePattern({ steps: { kick: [9, 2, 1], snare: [], hihat: ['1'] } });
    expect(normalized.steps.kick).toHaveLength(16);
    expect(normalized.steps.kick.slice(0, 3)).toEqual([0, 2, 1]);
    expect(normalized.steps.hihat[0]).toBe(1);
  });

  it('resolves presets and custom patterns', () => {
    expect(grooveById('half-time').id).toBe('half-time');
    expect(grooveById('custom', DEFAULT_CUSTOM_PATTERN).id).toBe('custom');
  });

  it('moves accents forward and avoids repeating the same random cell', () => {
    expect(nextMovingAccentIndex(15, 'forward')).toBe(0);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(nextMovingAccentIndex(0, 'random')).toBe(1);
    vi.restoreAllMocks();
  });

  it('calculates the complete routine bar count', () => {
    expect(routineTotalBars(DEFAULT_ROUTINE)).toBe(24);
  });
});
