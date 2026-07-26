import type { Subdivision } from './metronome';

export interface MediaBeatPosition {
  beatInBar: number;
  subdivisionInBeat: number;
  barIndex: number;
  absoluteSubdivisionIndex: number;
  beforeDownbeat: boolean;
}

function clampNumber(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function getMediaBeatPosition(
  mediaTime: number,
  bpm: number,
  beatsPerBar: number,
  subdivision: Subdivision,
  firstDownbeat: number,
  syncOffsetMs = 0,
): MediaBeatPosition {
  const safeBpm = clampNumber(bpm, 120, 20, 400);
  const safeBeats = Math.max(1, Math.round(clampNumber(beatsPerBar, 4, 1, 32)));
  const safeSubdivision = Math.max(1, Math.round(clampNumber(subdivision, 1, 1, 4))) as Subdivision;
  const effectiveTime = Math.max(0, mediaTime) - Math.max(0, firstDownbeat) - clampNumber(syncOffsetMs, 0, -500, 500) / 1000;

  if (effectiveTime < 0) {
    return {
      beatInBar: 0,
      subdivisionInBeat: 0,
      barIndex: 0,
      absoluteSubdivisionIndex: -1,
      beforeDownbeat: true,
    };
  }

  const subdivisionDuration = 60 / safeBpm / safeSubdivision;
  const absoluteSubdivisionIndex = Math.max(0, Math.floor((effectiveTime + 0.000001) / subdivisionDuration));
  const absoluteBeatIndex = Math.floor(absoluteSubdivisionIndex / safeSubdivision);

  return {
    beatInBar: absoluteBeatIndex % safeBeats,
    subdivisionInBeat: absoluteSubdivisionIndex % safeSubdivision,
    barIndex: Math.floor(absoluteBeatIndex / safeBeats),
    absoluteSubdivisionIndex,
    beforeDownbeat: false,
  };
}
