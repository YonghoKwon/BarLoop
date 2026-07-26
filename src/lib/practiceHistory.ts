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

export interface DailyPracticePoint {
  key: string;
  label: string;
  activeSeconds: number;
  sessions: number;
  completed: number;
  bestBpm: number;
}

const HISTORY_KEY = 'barloop:practice-history:v1';
const DATABASE_NAME = 'barloop-practice';
const STORE_NAME = 'sessions';

function openDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function mirrorHistory(items: PracticeSession[]): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    items.slice(0, 1000).forEach((item) => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  database.close();
}

async function readDatabaseHistory(): Promise<PracticeSession[]> {
  const database = await openDatabase();
  if (!database) return [];
  const items = await new Promise<PracticeSession[]>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => resolve([]);
  });
  database.close();
  return items
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, 1000);
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function readPracticeHistory(): PracticeSession[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.slice(0, 300) : [];
  } catch {
    return [];
  }
}

export async function restorePracticeHistoryFromDatabase(): Promise<PracticeSession[]> {
  const localItems = readPracticeHistory();
  if (localItems.length) {
    void mirrorHistory(localItems);
    return localItems;
  }

  const databaseItems = await readDatabaseHistory();
  if (databaseItems.length) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(databaseItems.slice(0, 300)));
  }
  return databaseItems.slice(0, 300);
}

export function writePracticeHistory(items: PracticeSession[]): void {
  const limited = items.slice(0, 300);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(limited));
  void mirrorHistory(limited);
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

export function getDailyPracticeSeries(
  items: PracticeSession[],
  days = 7,
  now: Date = new Date(),
): DailyPracticePoint[] {
  const safeDays = Math.max(1, Math.min(31, Math.round(days)));
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  const points = Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (safeDays - index - 1));
    return {
      key: localDateKey(date),
      label: date.toLocaleDateString('ko-KR', { weekday: 'short' }).replace('요일', ''),
      activeSeconds: 0,
      sessions: 0,
      completed: 0,
      bestBpm: 0,
    } satisfies DailyPracticePoint;
  });
  const byKey = new Map(points.map((point) => [point.key, point]));

  items.forEach((item) => {
    const startedAt = new Date(item.startedAt);
    if (Number.isNaN(startedAt.getTime())) return;
    const point = byKey.get(localDateKey(startedAt));
    if (!point) return;
    point.activeSeconds += Math.max(0, Number(item.activeSeconds) || 0);
    point.sessions += 1;
    point.completed += item.completed ? 1 : 0;
    point.bestBpm = Math.max(point.bestBpm, Number(item.bestBpm) || 0);
  });

  return points;
}

export function getPracticeStreak(items: PracticeSession[], now: Date = new Date()): number {
  const activeKeys = new Set(
    items
      .filter((item) => item.activeSeconds > 0)
      .map((item) => localDateKey(new Date(item.startedAt))),
  );
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;
  while (activeKeys.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getWeeklySummary(items: PracticeSession[]) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = items.filter((item) => new Date(item.startedAt).getTime() >= since);
  const completed = recent.filter((item) => item.completed).length;
  return {
    sessions: recent.length,
    totalSeconds: recent.reduce((sum, item) => sum + item.activeSeconds, 0),
    completed,
    bestBpm: recent.reduce((best, item) => Math.max(best, item.bestBpm || 0), 0),
    activeDays: getDailyPracticeSeries(items).filter((point) => point.activeSeconds > 0).length,
    streakDays: getPracticeStreak(items),
    completionRate: recent.length ? Math.round((completed / recent.length) * 100) : 0,
  };
}
