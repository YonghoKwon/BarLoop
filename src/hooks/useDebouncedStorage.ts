import { useEffect } from 'react';

export function useDebouncedStorage<T>(key: string, value: T, delayMs = 400): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage can be unavailable in private browsing or constrained webviews.
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, key, value]);
}
