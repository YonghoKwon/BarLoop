import { formatTime } from '../lib/time';

interface PracticeModeOverlayProps {
  visible: boolean;
  isPlaying: boolean;
  bpm: number;
  playbackRate: number;
  currentTime: number;
  loopStart: number;
  loopEnd: number;
  loopCount: number;
  currentBeat: number;
  beatsPerBar: number;
  metronomeEnabled: boolean;
  wakeLockActive: boolean;
  onClose: () => void;
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onNext: () => void;
  onToggleWakeLock: () => void;
}

export default function PracticeModeOverlay({
  visible,
  isPlaying,
  bpm,
  playbackRate,
  currentTime,
  loopStart,
  loopEnd,
  loopCount,
  currentBeat,
  beatsPerBar,
  metronomeEnabled,
  wakeLockActive,
  onClose,
  onTogglePlayback,
  onPrevious,
  onRestart,
  onNext,
  onToggleWakeLock,
}: PracticeModeOverlayProps) {
  if (!visible) return null;

  return (
    <div className="practice-overlay" role="dialog" aria-modal="true" aria-label="드러머 연습 모드">
      <div className="practice-topbar">
        <strong>DRUM PRACTICE</strong>
        <div className="button-row">
          <button type="button" onClick={onToggleWakeLock}>
            {wakeLockActive ? '화면 유지 ON' : '화면 유지'}
          </button>
          <button type="button" onClick={onClose}>닫기</button>
        </div>
      </div>

      <div className="practice-readout">
        <div>
          <span>BPM</span>
          <strong>{Math.round(bpm * playbackRate)}</strong>
          <small>원곡 {bpm} · {Math.round(playbackRate * 100)}%</small>
        </div>
        <div>
          <span>BEAT</span>
          <strong>{currentBeat + 1}</strong>
          <small>/ {beatsPerBar} {metronomeEnabled ? '· CLICK' : ''}</small>
        </div>
        <div>
          <span>LOOPS</span>
          <strong>{loopCount}</strong>
          <small>{formatTime(loopStart, true)}–{formatTime(loopEnd, true)}</small>
        </div>
      </div>

      <div className="practice-progress" aria-label="현재 반복 구간 진행률">
        <i
          style={{
            width: `${Math.max(0, Math.min(100, ((currentTime - loopStart) / Math.max(0.01, loopEnd - loopStart)) * 100))}%`,
          }}
        />
      </div>

      <div className="practice-controls">
        <button type="button" onClick={onPrevious}>이전</button>
        <button type="button" className="restart" onClick={onRestart}>처음</button>
        <button type="button" className="practice-play" onClick={onTogglePlayback}>
          {isPlaying ? '일시정지' : '재생'}
        </button>
        <button type="button" onClick={onNext}>다음</button>
      </div>
    </div>
  );
}
