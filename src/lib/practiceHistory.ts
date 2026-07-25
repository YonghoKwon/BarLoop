export interface PracticeSession {
  id: string;
  startedAt: string;
  endedAt: string;
  activeSeconds: number;
  label: string;
  startBpm?: number;
  bestBpm?: number;
  completed: boolean;
  note: string;
}

const HISTORY_KEY = 'barloop:practice-history:v1';

export function readPracticeHistory(): PracticeSession[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 300) : [];
  } catch {
    return [];
  }
}

export function writePracticeHistory(items: PracticeSession[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 300)));
}

export function addPracticeSession(session: PracticeSession): PracticeSession[] {
  const next = [session, ...readPracticeHistory()].slice(0, 300);
  writePracticeHistory(next);
  return next;
}

export function removePracticeSession(id: string): PracticeSession[] {
  const next = readPracticeHistory().filter((item) => item.id !== id);
  writePracticeHistory(next);
  return next;
}

export function getWeeklySummary(items: PracticeSession[]) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = items.filter((item) => new Date(item.startedAt).getTime() >= since);
  return {
    sessions: recent.length,
    totalSeconds: recent.reduce((sum, item) => sum + item.activeSeconds, 0),
    completed: recent.filter((item) => item.completed).length,
    bestBpm: recent.reduce((best, item) => Math.max(best, item.bestBpm || 0), 0),
  };
}
