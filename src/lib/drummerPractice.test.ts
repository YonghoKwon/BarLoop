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
  patternStepCount,
  resizePattern,
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

  it('normalizes invalid stored pattern data to the requested meter', () => {
    const normalized = normalizePattern({ beatsPerBar: 4, steps: { kick: [9, 2, 1], snare: [], hihat: ['1'] } });
    expect(normalized.steps.kick).toHaveLength(16);
    expect(normalized.steps.kick.slice(0, 3)).toEqual([0, 2, 1]);
    expect(normalized.steps.hihat[0]).toBe(1);
  });

  it('resizes patterns while preserving existing cells', () => {
    const sevenBeat = resizePattern(DEFAULT_CUSTOM_PATTERN, 7);
    expect(sevenBeat.beatsPerBar).toBe(7);
    expect(patternStepCount(sevenBeat.beatsPerBar)).toBe(28);
    expect(sevenBeat.steps.kick).toHaveLength(28);
    expect(sevenBeat.steps.kick[0]).toBe(DEFAULT_CUSTOM_PATTERN.steps.kick[0]);
  });

  it('includes syncopation and odd-meter presets', () => {
    expect(grooveById('offbeat-eighths').beatsPerBar).toBe(4);
    expect(grooveById('five-four-rock').steps.kick).toHaveLength(20);
    expect(grooveById('seven-four-drive').steps.ride).toHaveLength(28);
  });

  it('resolves presets and custom patterns', () => {
    expect(grooveById('half-time').id).toBe('half-time');
    expect(grooveById('custom', DEFAULT_CUSTOM_PATTERN).id).toBe('custom');
  });

  it('moves accents within the active meter and avoids repeating random cells', () => {
    expect(nextMovingAccentIndex(15, 'forward')).toBe(0);
    expect(nextMovingAccentIndex(27, 'forward', 28)).toBe(0);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(nextMovingAccentIndex(0, 'random', 28)).toBe(1);
    vi.restoreAllMocks();
  });

  it('calculates the complete routine bar count', () => {
    expect(routineTotalBars(DEFAULT_ROUTINE)).toBe(24);
  });
});
