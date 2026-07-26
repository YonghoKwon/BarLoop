import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PlayerCallbacks, PlayerHandle } from '../types';

interface LocalMediaPlayerProps extends PlayerCallbacks {
  src: string;
  name: string;
  kind: 'audio' | 'video';
  playbackRate: number;
  preservePitch: boolean;
  volume?: number;
}

const LocalMediaPlayer = forwardRef<PlayerHandle, LocalMediaPlayerProps>(
  ({ src, name, kind, playbackRate, preservePitch, volume = 0.85, onReady, onPlayingChange, onError }, ref) => {
    const mediaRef = useRef<HTMLMediaElement | null>(null);
    const [playing, setPlaying] = useState(false);

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
        setVolume: (nextVolume) => {
          if (mediaRef.current) mediaRef.current.volume = Math.min(1, Math.max(0, nextVolume));
        },
      }),
      [],
    );

    useEffect(() => {
      const media = mediaRef.current;
      if (!media) return;
      media.playbackRate = playbackRate;
      media.preservesPitch = preservePitch;
      media.volume = Math.min(1, Math.max(0, volume));
    }, [playbackRate, preservePitch, volume]);

    const updatePlaying = (next: boolean) => {
      setPlaying(next);
      onPlayingChange(next);
    };

    const togglePlayback = () => {
      const media = mediaRef.current;
      if (!media) return;
      if (media.paused) void media.play();
      else media.pause();
    };

    const handleLoadedMetadata = (media: HTMLMediaElement) => {
      media.playbackRate = playbackRate;
      media.preservesPitch = preservePitch;
      media.volume = Math.min(1, Math.max(0, volume));
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
            <span>{playing ? '재생 중 · 탭하여 일시정지' : '탭하여 재생'}</span>
            <div className={playing ? 'audio-bars playing' : 'audio-bars'} aria-hidden="true">
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
            onPlay={() => updatePlaying(true)}
            onPause={() => updatePlaying(false)}
            onEnded={() => updatePlaying(false)}
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
        onPlay={() => updatePlaying(true)}
        onPause={() => updatePlaying(false)}
        onEnded={() => updatePlaying(false)}
        onError={sharedError}
      />
    );
  },
);

LocalMediaPlayer.displayName = 'LocalMediaPlayer';

export default LocalMediaPlayer;
