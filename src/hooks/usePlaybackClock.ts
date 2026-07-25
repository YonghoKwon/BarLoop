import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { PlayerHandle } from '../types';

interface PlaybackClockOptions {
  playerRef: RefObject<PlayerHandle | null>;
  isReady: boolean;
  isPlaying: boolean;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  onLoop: () => void;
}

interface PlaybackClockResult {
  currentTime: number;
  setDisplayedTime: (seconds: number) => void;
  syncNow: () => number;
}

const UI_UPDATE_INTERVAL_MS = 80;
const LOOP_GUARD_MS = 110;

export function usePlaybackClock({
  playerRef,
  isReady,
  isPlaying,
  loopEnabled,
  loopStart,
  loopEnd,
  onLoop,
}: PlaybackClockOptions): PlaybackClockResult {
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const loopGuardRef = useRef(0);
  const onLoopRef = useRef(onLoop);

  useEffect(() => {
    onLoopRef.current = onLoop;
  }, [onLoop]);

  const setDisplayedTime = useCallback((seconds: number) => {
    const safeTime = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    currentTimeRef.current = safeTime;
    setCurrentTime(safeTime);
  }, []);

  const syncNow = useCallback(() => {
    const nextTime = playerRef.current?.getCurrentTime() ?? currentTimeRef.current;
    if (Number.isFinite(nextTime)) setDisplayedTime(nextTime);
    return Number.isFinite(nextTime) ? nextTime : currentTimeRef.current;
  }, [playerRef, setDisplayedTime]);

  useEffect(() => {
    if (!isReady || !isPlaying) return;

    let frameId = 0;
    let timerId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const player = playerRef.current;
      if (!player) return;

      const nextTime = player.getCurrentTime();
      if (!Number.isFinite(nextTime)) return;
      currentTimeRef.current = nextTime;

      const now = performance.now();
      if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
        lastUiUpdateRef.current = now;
        setCurrentTime(nextTime);
      }

      const loopLength = loopEnd - loopStart;
      if (
        loopEnabled &&
        loopLength > 0.04 &&
        nextTime >= loopEnd - 0.022 &&
        now - loopGuardRef.current > LOOP_GUARD_MS
      ) {
        loopGuardRef.current = now;
        player.seekTo(loopStart);
        void player.play();
        currentTimeRef.current = loopStart;
        setCurrentTime(loopStart);
        onLoopRef.current();
      }
    };

    const visibleLoop = () => {
      tick();
      frameId = requestAnimationFrame(visibleLoop);
    };

    const hiddenLoop = () => {
      tick();
      timerId = window.setTimeout(hiddenLoop, 45);
    };

    const startScheduler = () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      if (document.visibilityState === 'hidden') hiddenLoop();
      else frameId = requestAnimationFrame(visibleLoop);
    };

    startScheduler();
    document.addEventListener('visibilitychange', startScheduler);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', startScheduler);
    };
  }, [isPlaying, isReady, loopEnabled, loopEnd, loopStart, playerRef]);

  return { currentTime, setDisplayedTime, syncNow };
}
