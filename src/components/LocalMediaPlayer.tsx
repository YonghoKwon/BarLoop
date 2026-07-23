import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { PlayerCallbacks, PlayerHandle } from '../types';

interface LocalMediaPlayerProps extends PlayerCallbacks {
  src: string;
  name: string;
  kind: 'audio' | 'video';
  playbackRate: number;
}

const LocalMediaPlayer = forwardRef<PlayerHandle, LocalMediaPlayerProps>(
  ({ src, name, kind, playbackRate, onReady, onPlayingChange, onError }, ref) => {
    const mediaRef = useRef<HTMLMediaElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        play: () => mediaRef.current?.play(),
        pause: () => mediaRef.current?.pause(),
        seekTo: (seconds) => {
          if (mediaRef.current) mediaRef.current.currentTime = seconds;
        },
        getCurrentTime: () => mediaRef.current?.currentTime ?? 0,
        getDuration: () => mediaRef.current?.duration ?? 0,
        setPlaybackRate: (rate) => {
          if (mediaRef.current) mediaRef.current.playbackRate = rate;
        },
      }),
      [],
    );

    useEffect(() => {
      if (mediaRef.current) mediaRef.current.playbackRate = playbackRate;
    }, [playbackRate]);

    const togglePlayback = () => {
      const media = mediaRef.current;
      if (!media) return;
      if (media.paused) void media.play();
      else media.pause();
    };

    const handleLoadedMetadata = (media: HTMLMediaElement) => {
      media.playbackRate = playbackRate;
      onReady(media.duration);
    };

    const sharedError = () =>
      onError(
        kind === 'audio'
          ? '이 브라우저에서 재생할 수 없는 음원입니다. MP3, WAV, M4A 형식을 권장합니다.'
          : '이 브라우저에서 재생할 수 없는 영상입니다. MP4(H.264/AAC) 형식을 권장합니다.',
      );

    if (kind === 'audio') {
      return (
        <div className="audio-stage">
          <button type="button" className="audio-visual" onClick={togglePlayback}>
            <span className="audio-icon" aria-hidden="true">♪</span>
            <strong>{name}</strong>
            <span>{mediaRef.current?.paused === false ? '재생 중 · 클릭하여 일시정지' : '클릭하여 재생'}</span>
            <div className="audio-bars" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
            </div>
          </button>
          <audio
            ref={(element) => {
              mediaRef.current = element;
            }}
            src={src}
            preload="metadata"
            onLoadedMetadata={(event) => handleLoadedMetadata(event.currentTarget)}
            onPlay={() => onPlayingChange(true)}
            onPause={() => onPlayingChange(false)}
            onEnded={() => onPlayingChange(false)}
            onError={sharedError}
          />
        </div>
      );
    }

    return (
      <video
        ref={(element) => {
          mediaRef.current = element;
        }}
        className="media-element"
        src={src}
        preload="metadata"
        playsInline
        onClick={togglePlayback}
        onLoadedMetadata={(event) => handleLoadedMetadata(event.currentTarget)}
        onPlay={() => onPlayingChange(true)}
        onPause={() => onPlayingChange(false)}
        onEnded={() => onPlayingChange(false)}
        onError={sharedError}
      />
    );
  },
);

LocalMediaPlayer.displayName = 'LocalMediaPlayer';

export default LocalMediaPlayer;
