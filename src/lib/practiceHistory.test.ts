import { describe, expect, it } from 'vitest';
import { getDailyPracticeSeries, getPracticeStreak, type PracticeSession } from './practiceHistory';

function session(day: string, activeSeconds: number, bestBpm = 0): PracticeSession {
  return {
    id: day,
    startedAt: `${day}T12:00:00`,
    endedAt: `${day}T12:10:00`,
    activeSeconds,
    label: '연습',
    bestBpm,
    completed: true,
    note: '',
  };
}

describe('practice history summaries', () => {
  it('groups sessions into daily chart points', () => {
    const points = getDailyPracticeSeries(
      [session('2026-07-25', 600, 120), session('2026-07-25', 300, 130)],
      3,
      new Date('2026-07-26T12:00:00'),
    );
    expect(points.map((point) => point.activeSeconds)).toEqual([0, 900, 0]);
    expect(points[1]).toMatchObject({ sessions: 2, completed: 2, bestBpm: 130 });
  });

  it('counts consecutive active days ending today', () => {
    expect(
      getPracticeStreak(
        [session('2026-07-26', 300), session('2026-07-25', 300), session('2026-07-23', 300)],
        new Date('2026-07-26T12:00:00'),
      ),
    ).toBe(2);
  });
});
