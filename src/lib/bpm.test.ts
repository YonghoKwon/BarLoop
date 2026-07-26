import { describe, expect, it } from 'vitest';
import { clampBpm, normalizeBpmText, parseBpmText } from './bpm';

describe('BPM input helpers', () => {
  it('removes leading zeros while the user types', () => {
    expect(normalizeBpmText('088')).toBe('88');
    expect(normalizeBpmText('000120')).toBe('120');
  });

  it('keeps an empty draft so the field can be edited', () => {
    expect(normalizeBpmText('')).toBe('');
    expect(normalizeBpmText('abc')).toBe('');
  });

  it('removes non numeric characters and clamps the maximum', () => {
    expect(normalizeBpmText('1a2b0')).toBe('120');
    expect(normalizeBpmText('999')).toBe('400');
  });

  it('clamps committed BPM values to the supported range', () => {
    expect(clampBpm(5)).toBe(20);
    expect(clampBpm(88.4)).toBe(88);
    expect(clampBpm(900)).toBe(400);
  });

  it('uses the previous value when the draft is empty', () => {
    expect(parseBpmText('', 96)).toBe(96);
  });
});
