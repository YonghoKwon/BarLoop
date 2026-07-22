import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PlayerCallbacks, PlayerHandle } from '../types';

interface YouTubePlayerProps extends PlayerCallbacks {
  videoId: string;
  playbackRate: number;
}

interface YouTubePlayerInstance {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayerInstance;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('YouTube API를 초기화하지 못했습니다.'));
    };

    const existing = document.getElementById('youtube-iframe-api');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'youtube-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('YouTube API를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

const YouTubePlayer = forwardRef<PlayerHandle, YouTubePlayerProps>(
  ({ videoId, playbackRate, onReady, onPlayingChange, onError }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<YouTubePlayerInstance | null>(null);
    const playbackRateRef = useRef(playbackRate);

    useEffect(() => {
      playbackRateRef.current = playbackRate;
      playerRef.current?.setPlaybackRate(playbackRate);
    }, [playbackRate]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
        getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
        getDuration: () => playerRef.current?.getDuration() ?? 0,
        setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate(rate),
      }),
      [],
    );

    useEffect(() => {
      let disposed = false;

      void loadYouTubeApi()
        .then((YT) => {
          if (disposed || !mountRef.current) return;

          playerRef.current?.destroy();
          playerRef.current = new YT.Player(mountRef.current, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
            },
            events: {
              onReady: () => {
                playerRef.current?.setPlaybackRate(playbackRateRef.current);
                onReady(playerRef.current?.getDuration() ?? 0);
              },
              onStateChange: ({ data }) => {
                if (data === YT.PlayerState.PLAYING) onPlayingChange(true);
                if (data === YT.PlayerState.PAUSED || data === YT.PlayerState.ENDED) {
                  onPlayingChange(false);
                }
              },
              onError: ({ data }) => {
                const messages: Record<number, string> = {
                  2: 'YouTube 영상 ID가 올바르지 않습니다.',
                  5: 'HTML5 플레이어에서 이 영상을 재생할 수 없습니다.',
                  100: '영상이 삭제되었거나 비공개 상태입니다.',
                  101: '영상 소유자가 외부 재생을 허용하지 않았습니다.',
                  150: '영상 소유자가 외부 재생을 허용하지 않았습니다.',
                };
                onError(messages[data] ?? `YouTube 재생 오류가 발생했습니다. (${data})`);
              },
            },
          });
        })
        .catch((error: unknown) => {
          onError(error instanceof Error ? error.message : 'YouTube API 오류가 발생했습니다.');
        });

      return () => {
        disposed = true;
        playerRef.current?.destroy();
        playerRef.current = null;
      };
    }, [videoId, onError, onPlayingChange, onReady]);

    return <div ref={mountRef} className="youtube-mount" />;
  },
);

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;
