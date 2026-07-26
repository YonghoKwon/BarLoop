import { describe, expect, it } from 'vitest';
import { buildNearSilentWavBytes } from './audioPlaybackSession';

describe('playback session audio bridge', () => {
  it('builds a valid mono PCM WAV payload', () => {
    const bytes = buildNearSilentWavBytes(8000, 1);
    const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(text(36, 40)).toBe('data');
    expect(bytes.length).toBe(44 + 8000 * 2);
  });

  it('keeps the anchor signal effectively silent but non-zero', () => {
    const bytes = buildNearSilentWavBytes(100, 0.1);
    const view = new DataView(bytes.buffer);
    expect(Math.abs(view.getInt16(44, true))).toBe(1);
    expect(Math.abs(view.getInt16(46, true))).toBe(1);
  });
});
