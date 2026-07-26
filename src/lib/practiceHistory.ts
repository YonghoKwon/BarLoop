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
