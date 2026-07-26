import type { MediaCountMode, Subdivision } from '../lib/metronome';
import { getCurrentSubdivisionCount } from '../lib/subdivisionCount';
import { formatTime } from '../lib/time';
import SubdivisionCountGuide from './SubdivisionCountGuide';

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
  subdivisionInBeat: number;
  subdivision: Subdivision;
  beatsPerBar: number;
  metronomeEnabled: boolean;
  countMode: MediaCountMode;
  audibleBeat: boolean;
  countInRemaining: number | null;
  wakeLockActive: boolean;
  currentBarIndex: number;
  totalBars: number;
  selectedBarStart: number;
  selectedBarEnd: number;
  onClose: () => void;
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onNext: () => void;
  onToggleWakeLock: () => void;
}

export default function PracticeModeOverlay(props: PracticeModeOverlayProps) {
  if (!props.visible) return null;
  const currentCount = getCurrentSubdivisionCount(props.currentBeat, props.subdivisionInBeat, props.subdivision);
  const outputLabel = props.countMode === 'voice' ? 'VOICE' : props.countMode === 'both' ? 'BOTH' : 'CLICK';
  const rangeLength = Math.max(1, props.selectedBarEnd - props.selectedBarStart + 1);
  const rangePosition = props.currentBarIndex >= props.selectedBarStart && props.currentBarIndex <= props.selectedBarEnd
    ? props.currentBarIndex - props.selectedBarStart + 1
    : 0;
  const progress = Math.max(0, Math.min(100, ((props.currentTime - props.loopStart) / Math.max(.01, props.loopEnd - props.loopStart)) * 100));

  return (
    <div className="practice-overlay practice-overlay-v2" role="dialog" aria-modal="true" aria-label="드러머 연습 모드">
      <header className="practice-topbar">
        <div><span className="practice-brand">DRUM PRACTICE · BARLOOP</span><strong>{props.isPlaying ? '연습 진행 중' : '일시정지'}</strong></div>
        <div className="button-row"><button type="button" className={props.wakeLockActive ? 'active' : ''} onClick={props.onToggleWakeLock}>화면 유지 {props.wakeLockActive ? 'ON' : 'OFF'}</button><button type="button" onClick={props.onClose}>연습 화면 닫기</button></div>
      </header>

      <main className="practice-focus-layout">
        <section className="practice-count-hero">
          <span>{props.countInRemaining !== null ? `COUNT IN · ${props.countInRemaining}박` : props.metronomeEnabled ? (props.audibleBeat ? outputLabel : 'GAP CLICK') : 'VISUAL GUIDE'}</span>
          <strong className="practice-current-count">{currentCount}</strong>
          <small>{props.currentBeat + 1} / {props.beatsPerBar}박 · {Math.round(props.bpm * props.playbackRate)} BPM</small>
        </section>

        <section className="practice-loop-card">
          <div className="practice-loop-heading"><div><span>현재 마디</span><strong>{props.currentBarIndex >= 0 ? `${props.currentBarIndex + 1}마디` : '마디 밖'}</strong></div><div><span>반복 범위</span><strong>{props.selectedBarStart + 1}–{props.selectedBarEnd + 1}마디</strong></div><div><span>반복 횟수</span><strong>{props.loopCount}회</strong></div></div>
          <div className="practice-range-position"><span>{rangePosition > 0 ? `범위 안 ${rangePosition} / ${rangeLength}마디` : `전체 ${props.totalBars}마디`}</span><small>{formatTime(props.loopStart, true)}–{formatTime(props.loopEnd, true)}</small></div>
          <div className="practice-progress" aria-label="현재 반복 구간 진행률"><i style={{ width: `${progress}%` }} /></div>
        </section>

        <SubdivisionCountGuide beatsPerBar={props.beatsPerBar} subdivision={props.subdivision} beatInBar={props.currentBeat} subdivisionInBeat={props.subdivisionInBeat} audible={props.audibleBeat} className="practice-subdivision-guide" />
      </main>

      <footer className="practice-controls practice-controls-v2">
        <button type="button" onClick={props.onPrevious}><span>←</span><small>이전 범위</small></button>
        <button type="button" onClick={props.onRestart}><span>↺</span><small>A부터 다시</small></button>
        <button type="button" className="practice-play" onClick={props.onTogglePlayback}><span>{props.isPlaying ? '❚❚' : '▶'}</span><small>{props.isPlaying ? '일시정지' : '재생'}</small></button>
        <button type="button" onClick={props.onNext}><span>→</span><small>다음 범위</small></button>
      </footer>
    </div>
  );
}
