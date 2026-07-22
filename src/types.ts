export type SourceType = 'youtube' | 'local';
export type LoopMode = 'bars' | 'time';

export interface BarSegment {
  index: number;
  start: number;
  end: number;
}

export interface PlayerHandle {
  play: () => Promise<void> | void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
}

export interface PlayerCallbacks {
  onReady: (duration: number) => void;
  onPlayingChange: (isPlaying: boolean) => void;
  onError: (message: string) => void;
}
