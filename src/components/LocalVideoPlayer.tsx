import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PlayerCallbacks, PlayerHandle } from '../types';

interface LocalVideoPlayerProps extends PlayerCallbacks {
  src: string;
  playbackRate: number;
}

const LocalVideoPlayer = forwardRef<PlayerHandle, LocalVideoPlayerProps>(
  ({ src, playbackRate, onReady, onPlayingChange, onError }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(
      ref,
      () => ({
        play: () => videoRef.current?.play(),
        pause: () => videoRef.current?.pause(),
        seekTo: (seconds) => {
          if (videoRef.current) videoRef.current.currentTime = seconds;
        },
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => videoRef.current?.duration ?? 0,
        setPlaybackRate: (rate) => {
          if (videoRef.current) videoRef.current.playbackRate = rate;
        },
      }),
      [],
    );

    useEffect(() => {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
    }, [playbackRate]);

    return (
      <video
        ref={videoRef}
        className="media-element"
        src={src}
        preload="metadata"
        playsInline
        onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          if (video.paused) void video.play();
          else video.pause();
        }}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = playbackRate;
          onReady(event.currentTarget.duration);
        }}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
        onError={() =>
          onError(
            '이 브라우저에서 재생할 수 없는 영상입니다. MP4(H.264/AAC) 형식을 권장합니다.',
          )
        }
      />
    );
  },
);

LocalVideoPlayer.displayName = 'LocalVideoPlayer';

export default LocalVideoPlayer;
