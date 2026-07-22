import type { BarSegment } from '../types';

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function formatTime(value: number, precise = false): string {
  const safeValue = Math.max(0, Number.isFinite(value) ? value : 0);
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue - minutes * 60;

  return precise
    ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
    : `${minutes}:${Math.floor(seconds).toString().padStart(2, '0')}`;
}

export function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!trimmed.includes(':')) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const parts = trimmed.split(':').map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  return parts[0] * 60 + parts[1];
}

export function generateBars(
  duration: number,
  bpm: number,
  beatsPerBar: number,
  firstDownbeat: number,
): BarSegment[] {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(bpm) ||
    bpm <= 0 ||
    !Number.isFinite(beatsPerBar) ||
    beatsPerBar <= 0
  ) {
    return [];
  }

  const barLength = (60 / bpm) * beatsPerBar;
  const start = clamp(firstDownbeat, 0, duration);
  const result: BarSegment[] = [];

  for (let cursor = start, index = 0; cursor < duration; cursor += barLength, index += 1) {
    result.push({
      index,
      start: cursor,
      end: Math.min(cursor + barLength, duration),
    });
  }

  return result;
}

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (host.endsWith('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');

      const [, type, id] = url.pathname.split('/');
      if (['embed', 'shorts', 'live'].includes(type) && id) return id;
    }
  } catch {
    return null;
  }

  return null;
}
