import { useCallback, useEffect, useRef, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

interface WakeLockResult {
  supported: boolean;
  active: boolean;
  request: () => Promise<boolean>;
  release: () => Promise<void>;
}

export function useWakeLock(): WakeLockResult {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantedRef = useRef(false);
  const [active, setActive] = useState(false);

  const request = useCallback(async () => {
    const wakeLock = (navigator as unknown as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock) return false;
    wantedRef.current = true;
    try {
      const sentinel = await wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
        setActive(false);
      });
      return true;
    } catch {
      setActive(false);
      return false;
    }
  }, []);

  const release = useCallback(async () => {
    wantedRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (sentinel && !sentinel.released) await sentinel.release();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wantedRef.current && !sentinelRef.current) {
        void request();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [request]);

  useEffect(() => () => {
    void sentinelRef.current?.release();
  }, []);

  return { supported, active, request, release };
}
