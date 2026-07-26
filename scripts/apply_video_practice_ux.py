from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing replacement target: {label}')
    return text.replace(old, new, 1)


BAR_RANGE_PICKER = r'''import { useMemo, useState } from 'react';
import { formatTime } from '../lib/time';
import type { BarSegment } from '../types';

interface BarRangePickerProps {
  bars: BarSegment[];
  startIndex: number;
  endIndex: number;
  currentBarIndex: number;
  onStartChange: (index: number) => void;
  onEndChange: (index: number) => void;
  onSeek: (seconds: number) => void;
  onMoveRange: (direction: -1 | 1) => void;
}

export default function BarRangePicker({
  bars,
  startIndex,
  endIndex,
  currentBarIndex,
  onStartChange,
  onEndChange,
  onSeek,
  onMoveRange,
}: BarRangePickerProps) {
  const [editingBoundary, setEditingBoundary] = useState<'start' | 'end'>('start');
  const safeStart = Math.max(0, Math.min(bars.length - 1, startIndex));
  const safeEnd = Math.max(safeStart, Math.min(bars.length - 1, endIndex));
  const length = safeEnd - safeStart + 1;

  const visibleBars = useMemo(() => {
    if (bars.length <= 64) return bars;
    const focus = currentBarIndex >= 0 ? currentBarIndex : safeStart;
    const start = Math.max(0, Math.min(safeStart, focus) - 16);
    return bars.slice(start, Math.min(bars.length, start + 56));
  }, [bars, currentBarIndex, safeStart]);

  const setStart = (index: number) => {
    const next = Math.max(0, Math.min(index, bars.length - 1));
    onStartChange(next);
    if (next > safeEnd) onEndChange(next);
    onSeek(bars[next].start);
  };

  const setEnd = (index: number) => {
    const next = Math.max(safeStart, Math.min(index, bars.length - 1));
    onEndChange(next);
  };

  const applyLength = (barsLong: number) => {
    onEndChange(Math.min(bars.length - 1, safeStart + barsLong - 1));
  };

  const selectBar = (index: number) => {
    if (editingBoundary === 'start') {
      setStart(index);
      setEditingBoundary('end');
    } else {
      setEnd(index);
    }
  };

  return (
    <div className="bar-range-picker" aria-label="마디 반복 범위 편집기">
      <div className="bar-now-playing" role="status">
        <span>현재 재생</span>
        <strong>{currentBarIndex >= 0 ? `${currentBarIndex + 1}마디` : '마디 밖'}</strong>
        <small>{currentBarIndex >= 0 ? formatTime(bars[currentBarIndex].start, true) : '첫 다운비트 이전 구간'}</small>
      </div>

      <div className="bar-boundary-cards">
        <button type="button" className={editingBoundary === 'start' ? 'boundary-card active' : 'boundary-card'} onClick={() => setEditingBoundary('start')}>
          <span>A · 시작</span><strong>{safeStart + 1}마디</strong><small>{formatTime(bars[safeStart].start, true)}</small>
        </button>
        <div className="range-arrow">→</div>
        <button type="button" className={editingBoundary === 'end' ? 'boundary-card active' : 'boundary-card'} onClick={() => setEditingBoundary('end')}>
          <span>B · 종료</span><strong>{safeEnd + 1}마디</strong><small>{formatTime(bars[safeEnd].end, true)}</small>
        </button>
      </div>

      <div className="bar-range-sliders">
        <label><span>A 시작 마디</span><input aria-label="A 시작 마디" type="range" min={0} max={bars.length - 1} value={safeStart} onChange={(event) => setStart(Number(event.target.value))} /></label>
        <label><span>B 종료 마디</span><input aria-label="B 종료 마디" type="range" min={safeStart} max={bars.length - 1} value={safeEnd} onChange={(event) => setEnd(Number(event.target.value))} /></label>
      </div>

      <div className="bar-range-actions">
        <button type="button" disabled={currentBarIndex < 0} onClick={() => currentBarIndex >= 0 && setStart(currentBarIndex)}>현재 마디를 A로</button>
        <button type="button" disabled={currentBarIndex < 0} onClick={() => currentBarIndex >= 0 && setEnd(currentBarIndex)}>현재 마디를 B로</button>
        <button type="button" onClick={() => onMoveRange(-1)}>← 범위 이동</button>
        <button type="button" onClick={() => onMoveRange(1)}>범위 이동 →</button>
      </div>

      <div className="bar-length-presets" aria-label="반복 마디 길이">
        <span>길이 {length}마디</span>
        {[1, 2, 4, 8].map((value) => <button key={value} type="button" className={length === value ? 'active' : ''} onClick={() => applyLength(value)}>{value}마디</button>)}
      </div>

      <div className="bar-grid modern-bar-grid">
        {visibleBars.map((bar) => {
          const selected = bar.index >= safeStart && bar.index <= safeEnd;
          const current = bar.index === currentBarIndex;
          const boundary = bar.index === safeStart ? 'start' : bar.index === safeEnd ? 'end' : '';
          return (
            <button
              type="button"
              key={bar.index}
              className={['bar-button', selected ? 'active' : '', current ? 'current' : '', boundary ? `boundary-${boundary}` : ''].filter(Boolean).join(' ')}
              aria-label={`${bar.index + 1}마디${current ? ' 현재 재생' : ''}${selected ? ' 반복 선택' : ''}`}
              onClick={() => selectBar(bar.index)}
            >
              <strong>{bar.index + 1}</strong><span>{formatTime(bar.start)}</span>{current && <i>NOW</i>}
            </button>
          );
        })}
      </div>
      {visibleBars.length < bars.length && <p className="hint">현재 마디와 반복 범위 주변을 표시합니다. 슬라이더로 전체 {bars.length}마디를 바로 이동할 수 있습니다.</p>}
    </div>
  );
}
'''

PRACTICE_OVERLAY = r'''import type { MediaCountMode, Subdivision } from '../lib/metronome';
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
        <div><span className="practice-brand">BARLOOP PRACTICE</span><strong>{props.isPlaying ? '연습 진행 중' : '일시정지'}</strong></div>
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
'''

METRONOME_PANEL = r'''import type { CountInClickMode, MediaCountMode, Subdivision } from '../lib/metronome';
import { isKoreanCountVoiceSupported } from '../lib/koreanCountVoice';
import { getCurrentSubdivisionCount } from '../lib/subdivisionCount';
import type { MetronomeSound } from '../lib/standaloneMetronome';
import SubdivisionCountGuide from './SubdivisionCountGuide';

const SOUND_OPTIONS: Array<{ value: MetronomeSound; label: string }> = [
  { value: 'classic', label: 'Classic' }, { value: 'wood', label: 'Wood Block' },
  { value: 'rim', label: 'Rim' }, { value: 'cowbell', label: 'Cowbell' },
  { value: 'digital', label: 'Digital' }, { value: 'clave', label: 'Clave' },
  { value: 'shaker', label: 'Shaker' }, { value: 'low', label: 'Low Pulse' },
];

interface MetronomePanelProps {
  enabled: boolean; onEnabledChange: (enabled: boolean) => void;
  countInBars: number; onCountInBarsChange: (bars: number) => void;
  subdivision: Subdivision; onSubdivisionChange: (subdivision: Subdivision) => void;
  volume: number; onVolumeChange: (volume: number) => void;
  accentVolume: number; onAccentVolumeChange: (volume: number) => void;
  subdivisionVolume: number; onSubdivisionVolumeChange: (volume: number) => void;
  sound: MetronomeSound; onSoundChange: (sound: MetronomeSound) => void;
  accentSound: MetronomeSound; onAccentSoundChange: (sound: MetronomeSound) => void;
  countMode: MediaCountMode; onCountModeChange: (mode: MediaCountMode) => void;
  countInClickMode: CountInClickMode; onCountInClickModeChange: (mode: CountInClickMode) => void;
  syncOffsetMs: number; onSyncOffsetMsChange: (offsetMs: number) => void;
  gapEnabled: boolean; onGapEnabledChange: (enabled: boolean) => void;
  gapPlayBars: number; gapMuteBars: number;
  onGapPlayBarsChange: (bars: number) => void; onGapMuteBarsChange: (bars: number) => void;
  beatInBar: number; subdivisionInBeat: number; beatsPerBar: number; audibleBeat: boolean; countInRemaining: number | null;
  onTestClick: () => void; onTestAccent: () => void;
}

export default function MetronomePanel(props: MetronomePanelProps) {
  const currentCount = getCurrentSubdivisionCount(props.beatInBar, props.subdivisionInBeat, props.subdivision);
  const voiceSupported = isKoreanCountVoiceSupported();
  const outputLabel = props.countMode === 'voice' ? 'VOICE' : props.countMode === 'both' ? 'BOTH' : 'CLICK';
  const statusLabel = props.countInRemaining !== null ? 'COUNT IN' : !props.enabled ? 'GUIDE' : props.audibleBeat ? outputLabel : 'GAP';

  return (
    <section className="panel tool-panel metronome-panel">
      <div className="section-title-row"><div><span className="eyebrow">CLICK</span><h2>메트로놈·카운트인</h2></div><label className="switch-label"><input type="checkbox" checked={props.enabled} onChange={(event) => props.onEnabledChange(event.target.checked)} /><span>{props.enabled ? 'ON' : 'OFF'}</span></label></div>
      <div className="metronome-count-readout"><strong>{currentCount}</strong><span>{statusLabel}</span></div>
      <SubdivisionCountGuide beatsPerBar={props.beatsPerBar} subdivision={props.subdivision} beatInBar={props.beatInBar} subdivisionInBeat={props.subdivisionInBeat} audible={props.audibleBeat} compact />
      {props.countInRemaining !== null && <div className="count-in-banner" role="status">카운트인 <strong>{props.countInRemaining}</strong>박 남음 · 현재 <strong>{currentCount}</strong></div>}

      <div className="compact-grid three">
        <label>카운트인<select value={props.countInBars} onChange={(event) => props.onCountInBarsChange(Number(event.target.value))}><option value={0}>없음</option><option value={1}>1마디</option><option value={2}>2마디</option><option value={4}>4마디</option></select></label>
        <label>서브디비전<select value={props.subdivision} onChange={(event) => props.onSubdivisionChange(Number(event.target.value) as Subdivision)}><option value={1}>4분음표</option><option value={2}>8분음표</option><option value={3}>셋잇단</option><option value={4}>16분음표</option></select></label>
        <label>메인 박 출력<select value={props.countMode} onChange={(event) => props.onCountModeChange(event.target.value as MediaCountMode)}><option value="click">클릭음</option><option value="voice">한국어 카운트</option><option value="both">클릭 + 한국어 카운트</option></select></label>
      </div>

      <div className="click-sound-mixer">
        <div className="section-title-row"><div><strong>클릭 음색 믹서</strong><span>기본 박과 강조 박을 서로 다른 음색으로 구분합니다.</span></div><div className="click-test-actions"><button type="button" onClick={props.onTestClick}>기본음</button><button type="button" onClick={props.onTestAccent}>강조음</button></div></div>
        <div className="compact-grid two">
          <label>기본 클릭 음색<select value={props.sound} disabled={props.countMode === 'voice'} onChange={(event) => props.onSoundChange(event.target.value as MetronomeSound)}>{SOUND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>강조 클릭 음색<select value={props.accentSound} disabled={props.countMode === 'voice'} onChange={(event) => props.onAccentSoundChange(event.target.value as MetronomeSound)}>{SOUND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>기본 클릭 {Math.round(props.volume * 100)}%<input type="range" min={0.05} max={1} step={0.05} value={props.volume} onChange={(event) => props.onVolumeChange(Number(event.target.value))} /></label>
          <label>강조 클릭 {Math.round(props.accentVolume * 100)}%<input type="range" min={0.05} max={1} step={0.05} value={props.accentVolume} onChange={(event) => props.onAccentVolumeChange(Number(event.target.value))} /></label>
          <label>세부 박 클릭 {Math.round(props.subdivisionVolume * 100)}%<input type="range" min={0} max={1} step={0.05} value={props.subdivisionVolume} onChange={(event) => props.onSubdivisionVolumeChange(Number(event.target.value))} /></label>
          <label>카운트인 클릭<select value={props.countInClickMode} onChange={(event) => props.onCountInClickModeChange(event.target.value as CountInClickMode)}><option value="beat">숫자 박만 클릭</option><option value="subdivision">선택한 모든 칸 클릭</option></select></label>
        </div>
      </div>
      {!voiceSupported && props.countMode !== 'click' && <p className="hint">이 브라우저에서는 한국어 시스템 음성을 찾지 못해 클릭음으로 자동 대체됩니다.</p>}

      <div className="sync-offset-control"><div className="label-row"><label htmlFor="media-click-sync">클릭 싱크 보정</label><strong>{props.syncOffsetMs > 0 ? '+' : ''}{props.syncOffsetMs}ms</strong></div><input id="media-click-sync" type="range" min={-200} max={200} step={5} value={props.syncOffsetMs} onChange={(event) => props.onSyncOffsetMsChange(Number(event.target.value))} /><div className="sync-offset-actions"><button type="button" onClick={() => props.onSyncOffsetMsChange(Math.max(-200, props.syncOffsetMs - 10))}>−10ms</button><button type="button" onClick={() => props.onSyncOffsetMsChange(0)}>0으로</button><button type="button" onClick={() => props.onSyncOffsetMsChange(Math.min(200, props.syncOffsetMs + 10))}>+10ms</button></div><p className="hint">음수가 클릭을 앞당기고, 양수가 클릭을 늦춥니다.</p></div>
      <div className="gap-click-row"><label className="switch-label"><input type="checkbox" checked={props.gapEnabled} onChange={(event) => props.onGapEnabledChange(event.target.checked)} /><span>Gap Click</span></label><label>소리<input type="number" min={1} max={16} value={props.gapPlayBars} onChange={(event) => props.onGapPlayBarsChange(Number(event.target.value))} />마디</label><label>무음<input type="number" min={1} max={16} value={props.gapMuteBars} onChange={(event) => props.onGapMuteBarsChange(Number(event.target.value))} />마디</label></div>
      <p className="hint">화면의 카운트 가이드는 클릭을 꺼도 영상 시간에 맞춰 계속 움직입니다.</p>
    </section>
  );
}
'''

CSS = r'''/* Video practice loop picker, practice mode v2 and training audio controls. */
.now-playing-bar-inline { display:flex; justify-content:center; gap:8px; align-items:center; margin:8px 0 2px; color:#9ca8bc; font-size:.76rem; }
.now-playing-bar-inline strong { color:#fff; padding:5px 10px; border-radius:999px; background:#20283a; }
.bar-range-picker { display:grid; gap:12px; }
.bar-now-playing { display:grid; grid-template-columns:auto auto 1fr; align-items:center; gap:8px; padding:10px 12px; border:1px solid rgba(111,130,166,.35); border-radius:13px; background:linear-gradient(135deg,rgba(84,105,150,.14),rgba(15,19,28,.94)); }
.bar-now-playing span,.bar-now-playing small { color:#98a4b8; font-size:.72rem; }.bar-now-playing strong{color:#fff;font-size:1.05rem}.bar-now-playing small{text-align:right}
.bar-boundary-cards{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}.range-arrow{color:#66738a;font-weight:900}
.boundary-card{display:grid;gap:2px;padding:11px;border:1px solid #343d50;border-radius:13px;background:#121722;text-align:left}.boundary-card span{color:#8995aa;font-size:.68rem}.boundary-card strong{color:#fff;font-size:1.05rem}.boundary-card small{color:#69758a}.boundary-card.active{border-color:#7e8dff;background:rgba(126,141,255,.13);box-shadow:0 0 0 2px rgba(126,141,255,.1)}
.bar-range-sliders{display:grid;gap:8px;padding:10px;border-radius:12px;background:#111620}.bar-range-sliders label{display:grid;grid-template-columns:88px 1fr;align-items:center;gap:8px;color:#aeb7c8;font-size:.7rem}
.bar-range-actions,.bar-length-presets{display:flex;flex-wrap:wrap;gap:6px}.bar-range-actions button,.bar-length-presets button{min-height:38px}.bar-length-presets{align-items:center}.bar-length-presets>span{margin-right:auto;color:#dce2ef;font-weight:800;font-size:.75rem}.bar-length-presets button.active{border-color:#7d8cff;background:#7d8cff;color:#fff}
.modern-bar-grid .bar-button{position:relative}.modern-bar-grid .bar-button.current{outline:2px solid #67e1c2;outline-offset:2px}.modern-bar-grid .bar-button.boundary-start{box-shadow:inset 4px 0 0 #7e8dff}.modern-bar-grid .bar-button.boundary-end{box-shadow:inset -4px 0 0 #ff9c72}.modern-bar-grid .bar-button i{position:absolute;top:2px;right:3px;color:#67e1c2;font-size:.48rem;font-style:normal;font-weight:900}
.click-sound-mixer{display:grid;gap:10px;margin-top:12px;padding:12px;border:1px solid #343d50;border-radius:13px;background:#111620}.click-sound-mixer .section-title-row span{display:block;margin-top:3px;color:#8f9bb0;font-size:.68rem}.click-test-actions{display:flex;gap:5px}.click-test-actions button{min-height:34px}
.practice-overlay-v2{padding:max(14px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));background:radial-gradient(circle at 50% 25%,#19233a 0,#090c13 56%,#05070b 100%)}
.practice-overlay-v2 .practice-topbar{align-items:center}.practice-overlay-v2 .practice-topbar>div:first-child{display:grid;gap:2px}.practice-brand{color:#7f8cff;font-size:.62rem;font-weight:900;letter-spacing:.14em}.practice-focus-layout{width:min(100%,980px);margin:auto;display:grid;grid-template-columns:minmax(210px,.65fr) minmax(300px,1.35fr);gap:18px;align-items:center}.practice-count-hero{display:grid;place-items:center;min-height:260px;padding:24px;border:1px solid rgba(126,141,255,.28);border-radius:28px;background:radial-gradient(circle,rgba(126,141,255,.17),rgba(16,21,32,.82) 62%);text-align:center}.practice-count-hero>span{color:#91a0bb;font-size:.72rem;font-weight:800;letter-spacing:.1em}.practice-count-hero>strong{font-size:clamp(4rem,12vw,8rem);line-height:1;color:#fff}.practice-count-hero>small{color:#aab5c8}.practice-loop-card{display:grid;gap:14px;padding:18px;border:1px solid #333d50;border-radius:22px;background:rgba(13,17,25,.88)}.practice-loop-heading{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.practice-loop-heading>div{display:grid;gap:4px;padding:10px;border-radius:12px;background:#171d29}.practice-loop-heading span,.practice-range-position span{color:#8e9bb0;font-size:.66rem}.practice-loop-heading strong{color:#fff;font-size:1rem}.practice-range-position{display:flex;justify-content:space-between;color:#aab5c8}.practice-controls-v2{width:min(100%,760px);margin:18px auto 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.practice-controls-v2 button{display:grid;place-items:center;gap:4px;min-height:66px}.practice-controls-v2 button span{font-size:1.35rem}.practice-controls-v2 button small{font-size:.65rem}.practice-controls-v2 .practice-play{transform:none;min-height:78px;border-radius:18px}
.training-audio-settings{display:grid;gap:12px}.training-audio-settings .training-audio-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.training-guide-readout{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;border-radius:12px;background:#101620;color:#9eabc0}.training-guide-readout strong{color:#fff;font-size:1.2rem}.kit-mode-hint{color:#8e9aaf;font-size:.7rem;line-height:1.45}.instrument-label.optional-kit{border-color:rgba(117,145,255,.55)}
@media(max-width:760px){.bar-now-playing{grid-template-columns:auto auto}.bar-now-playing small{grid-column:1/-1;text-align:left}.bar-range-actions button{flex:1 1 calc(50% - 4px)}.practice-focus-layout{grid-template-columns:1fr}.practice-count-hero{min-height:190px}.practice-loop-heading{grid-template-columns:repeat(3,minmax(0,1fr))}.practice-controls-v2{position:sticky;bottom:max(4px,env(safe-area-inset-bottom));z-index:4}.click-test-actions{width:100%}.click-test-actions button{flex:1}}
@media(max-width:430px){.bar-boundary-cards{grid-template-columns:1fr 22px 1fr}.boundary-card{padding:9px}.bar-range-sliders label{grid-template-columns:76px 1fr}.practice-loop-heading{grid-template-columns:1fr}.practice-count-hero>strong{font-size:4.4rem}.practice-controls-v2 button{min-width:0;padding:7px 3px}.practice-controls-v2 button small{font-size:.57rem}}
'''

# Write new/replaced components.
write('src/components/BarRangePicker.tsx', BAR_RANGE_PICKER)
write('src/components/PracticeModeOverlay.tsx', PRACTICE_OVERLAY)
write('src/components/MetronomePanel.tsx', METRONOME_PANEL)
write('src/practice-ux-v2.css', CSS)

# main.tsx import.
main = read('src/main.tsx')
main = replace_once(main, "import './accent-flash-enhanced.css';", "import './accent-flash-enhanced.css';\nimport './practice-ux-v2.css';", 'main css import')
write('src/main.tsx', main)

# App.tsx state, loop picker and audio settings.
app = read('src/App.tsx')
app = replace_once(app, "import LocalMediaPlayer from './components/LocalMediaPlayer';", "import BarRangePicker from './components/BarRangePicker';\nimport LocalMediaPlayer from './components/LocalMediaPlayer';", 'App BarRangePicker import')
app = replace_once(app, "import { preparePlaybackAudioSession, releasePlaybackAudioSession } from './lib/audioPlaybackSession';", "import { preparePlaybackAudioSession, releasePlaybackAudioSession } from './lib/audioPlaybackSession';\nimport type { MetronomeSound } from './lib/standaloneMetronome';", 'App MetronomeSound import')
app = replace_once(app, "const SETTINGS_KEY = 'barloop:practice-settings:v3';", "const SETTINGS_KEY = 'barloop:practice-settings:v4';\nconst METRONOME_SOUNDS: MetronomeSound[] = ['classic', 'wood', 'rim', 'cowbell', 'digital', 'clave', 'shaker', 'low'];", 'App settings key')
app = replace_once(app, "  metronomeVolume: number;\n  countMode: MediaCountMode;", "  metronomeVolume: number;\n  accentVolume: number;\n  subdivisionVolume: number;\n  metronomeSound: MetronomeSound;\n  accentSound: MetronomeSound;\n  countMode: MediaCountMode;", 'App stored audio fields')
app = replace_once(app, "  metronomeVolume: 0.55,\n  countMode: 'click',", "  metronomeVolume: 0.55,\n  accentVolume: 0.82,\n  subdivisionVolume: 0.3,\n  metronomeSound: 'classic',\n  accentSound: 'wood',\n  countMode: 'click',", 'App audio defaults')
app = replace_once(app, "      metronomeVolume: clamp(Number(parsed.metronomeVolume) || 0.55, 0.05, 1),\n      countMode:", "      metronomeVolume: clamp(Number(parsed.metronomeVolume) || 0.55, 0.05, 1),\n      accentVolume: clamp(Number(parsed.accentVolume) || 0.82, 0.05, 1),\n      subdivisionVolume: clamp(Number(parsed.subdivisionVolume) || 0.3, 0, 1),\n      metronomeSound: METRONOME_SOUNDS.includes(parsed.metronomeSound as MetronomeSound) ? parsed.metronomeSound as MetronomeSound : 'classic',\n      accentSound: METRONOME_SOUNDS.includes(parsed.accentSound as MetronomeSound) ? parsed.accentSound as MetronomeSound : 'wood',\n      countMode:", 'App read audio')
app = replace_once(app, "  const [metronomeVolume, setMetronomeVolume] = useState(initialSettingsRef.current.metronomeVolume);\n  const [countMode", "  const [metronomeVolume, setMetronomeVolume] = useState(initialSettingsRef.current.metronomeVolume);\n  const [accentVolume, setAccentVolume] = useState(initialSettingsRef.current.accentVolume);\n  const [subdivisionVolume, setSubdivisionVolume] = useState(initialSettingsRef.current.subdivisionVolume);\n  const [metronomeSound, setMetronomeSound] = useState<MetronomeSound>(initialSettingsRef.current.metronomeSound);\n  const [accentSound, setAccentSound] = useState<MetronomeSound>(initialSettingsRef.current.accentSound);\n  const [countMode", 'App audio state')
app = replace_once(app, "  const activeLoop = useMemo(() => {", "  const currentBarIndex = useMemo(() => {\n    if (bars.length === 0) return -1;\n    const found = bars.findIndex((bar) => currentTime >= bar.start && currentTime < bar.end);\n    if (found >= 0) return found;\n    return currentTime >= bars[bars.length - 1].end ? bars.length - 1 : -1;\n  }, [bars, currentTime]);\n\n  const activeLoop = useMemo(() => {", 'App current bar')
# Remove obsolete visibleBars block.
app = re.sub(r"\n  const visibleBars = useMemo\(\(\) => \{.*?\n  \}, \[bars, selectedBars\?\.startIndex\]\);\n", "\n", app, count=1, flags=re.S)
app = replace_once(app, "    metronomeVolume,\n    countMode,", "    metronomeVolume,\n    accentVolume,\n    subdivisionVolume,\n    metronomeSound,\n    accentSound,\n    countMode,", 'App stored settings body')
app = replace_once(app, "    metronomeVolume,\n    midiMappings,", "    metronomeVolume,\n    accentVolume,\n    subdivisionVolume,\n    metronomeSound,\n    accentSound,\n    midiMappings,", 'App stored deps')
app = replace_once(app, "    volume: metronomeVolume,\n    playbackRate,", "    volume: metronomeVolume,\n    accentVolume,\n    subdivisionVolume,\n    sound: metronomeSound,\n    accentSound,\n    playbackRate,", 'App metronome settings fields')
app = replace_once(app, "    beatsPerBar,\n    bpm,", "    accentSound,\n    accentVolume,\n    beatsPerBar,\n    bpm,", 'App metronome deps start')
app = replace_once(app, "    metronomeVolume,\n    outputHasClick,", "    metronomeSound,\n    metronomeVolume,\n    subdivisionVolume,\n    outputHasClick,", 'App metronome deps')
app = replace_once(app, "          volume: metronomeVolume,\n          subdivision,", "          volume: metronomeVolume,\n          accentVolume,\n          subdivisionVolume,\n          sound: metronomeSound,\n          accentSound,\n          subdivision,", 'App countin audio fields')
app = replace_once(app, "    countInClickMode,\n    isPlaying,", "    countInClickMode,\n    accentSound,\n    accentVolume,\n    isPlaying,", 'App toggle deps 1')
app = replace_once(app, "    metronomeVolume,\n    outputHasClick,", "    metronomeSound,\n    metronomeVolume,\n    subdivisionVolume,\n    outputHasClick,", 'App toggle deps 2')
app = replace_once(app, "    setMetronomeEnabled(false);\n    setCountInBars(1);", "    setMetronomeEnabled(false);\n    setMetronomeVolume(DEFAULT_SETTINGS.metronomeVolume);\n    setAccentVolume(DEFAULT_SETTINGS.accentVolume);\n    setSubdivisionVolume(DEFAULT_SETTINGS.subdivisionVolume);\n    setMetronomeSound(DEFAULT_SETTINGS.metronomeSound);\n    setAccentSound(DEFAULT_SETTINGS.accentSound);\n    setCountInBars(1);", 'App reset audio')
app = replace_once(app, "            <div className=\"transport-row sticky-mobile-controls\">", "            <div className=\"now-playing-bar-inline\" role=\"status\"><span>현재 연주 위치</span><strong>{currentBarIndex >= 0 ? `${currentBarIndex + 1}마디` : '마디 밖'}</strong>{selectedBars && <span>반복 {selectedBars.startIndex + 1}–{selectedBars.endIndex + 1}마디</span>}</div>\n\n            <div className=\"transport-row sticky-mobile-controls\">", 'App current bar inline')
# Replace bars UI expression inside loop panel.
loop_start = app.index("              {loopMode === 'bars' ?")
loop_end = app.index("            </section>", loop_start)
time_branch_marker = " : <div className=\"time-loop-controls\">"
old_expr = app[loop_start:loop_end]
marker_index = old_expr.index(time_branch_marker)
time_branch = old_expr[marker_index + 3:]
new_expr = "              {loopMode === 'bars' ? bars.length > 0 && selectedBars ? (\n                <BarRangePicker bars={bars} startIndex={selectedBars.startIndex} endIndex={selectedBars.endIndex} currentBarIndex={currentBarIndex} onStartChange={(index) => { setSelectedBarStart(index); setSelectedBarEnd((end) => Math.max(end, index)); }} onEndChange={(index) => setSelectedBarEnd(Math.max(selectedBars.startIndex, index))} onSeek={seekTo} onMoveRange={moveBarSelection} />\n              ) : <div className=\"empty-control\">BPM과 첫 다운비트를 맞춘 뒤 마디를 나눠 주세요.</div> : " + time_branch
app = app[:loop_start] + new_expr + app[loop_end:]
# Replace MetronomePanel one-line call.
old_panel = re.search(r"          <MetronomePanel .*? />", app).group(0)
new_panel = "          <MetronomePanel enabled={metronomeEnabled} onEnabledChange={setMetronomeEnabled} countInBars={countInBars} onCountInBarsChange={setCountInBars} subdivision={subdivision} onSubdivisionChange={setSubdivision} volume={metronomeVolume} onVolumeChange={setMetronomeVolume} accentVolume={accentVolume} onAccentVolumeChange={setAccentVolume} subdivisionVolume={subdivisionVolume} onSubdivisionVolumeChange={setSubdivisionVolume} sound={metronomeSound} onSoundChange={setMetronomeSound} accentSound={accentSound} onAccentSoundChange={setAccentSound} countMode={countMode} onCountModeChange={setCountMode} countInClickMode={countInClickMode} onCountInClickModeChange={setCountInClickMode} syncOffsetMs={syncOffsetMs} onSyncOffsetMsChange={(value) => setSyncOffsetMs(clamp(Math.round(value), -200, 200))} gapEnabled={gapEnabled} onGapEnabledChange={setGapEnabled} gapPlayBars={gapPlayBars} gapMuteBars={gapMuteBars} onGapPlayBarsChange={(value) => setGapPlayBars(clamp(Math.round(value), 1, 16))} onGapMuteBarsChange={(value) => setGapMuteBars(clamp(Math.round(value), 1, 16))} beatInBar={beatInBar} subdivisionInBeat={subdivisionInBeat} beatsPerBar={beatsPerBar} audibleBeat={audibleBeat} countInRemaining={countInRemaining} onTestClick={() => void metronomeRef.current.testClick(false)} onTestAccent={() => void metronomeRef.current.testClick(true)} />"
app = app.replace(old_panel, new_panel, 1)
old_overlay = re.search(r"      <PracticeModeOverlay .*? />", app).group(0)
new_overlay = "      <PracticeModeOverlay visible={practiceMode} isPlaying={isPlaying} bpm={Number.isFinite(bpm) ? bpm : 120} playbackRate={playbackRate} currentTime={currentTime} loopStart={activeLoop.start} loopEnd={activeLoop.end} loopCount={loopCount} currentBeat={beatInBar} subdivisionInBeat={subdivisionInBeat} subdivision={subdivision} beatsPerBar={beatsPerBar} metronomeEnabled={metronomeEnabled} countMode={countMode} audibleBeat={audibleBeat} countInRemaining={countInRemaining} wakeLockActive={wakeLock.active} currentBarIndex={currentBarIndex} totalBars={bars.length} selectedBarStart={selectedBars?.startIndex ?? 0} selectedBarEnd={selectedBars?.endIndex ?? 0} onClose={() => void closePracticeMode()} onTogglePlayback={() => void togglePlayback()} onPrevious={() => moveBarSelection(-1)} onRestart={restartLoop} onNext={() => moveBarSelection(1)} onToggleWakeLock={() => { if (wakeLock.active) void wakeLock.release(); else void wakeLock.request(); }} />"
app = app.replace(old_overlay, new_overlay, 1)
write('src/App.tsx', app)

# Media metronome audio engine.
metro = read('src/lib/metronome.ts')
metro = replace_once(metro, "  type MetronomeAudioState,\n} from './standaloneMetronome';", "  type MetronomeAudioState,\n  type MetronomeSound,\n} from './standaloneMetronome';", 'media engine sound import')
metro = replace_once(metro, "  volume: number;\n  playbackRate: number;", "  volume: number;\n  accentVolume: number;\n  subdivisionVolume: number;\n  sound: MetronomeSound;\n  accentSound: MetronomeSound;\n  playbackRate: number;", 'media engine settings fields')
metro = replace_once(metro, "  volume: number;\n  subdivision: Subdivision;", "  volume: number;\n  accentVolume: number;\n  subdivisionVolume: number;\n  sound: MetronomeSound;\n  accentSound: MetronomeSound;\n  subdivision: Subdivision;", 'countin fields')
metro = metro.replace("          settings.volume,\n        );", "          settings,\n        );", 1)
metro = replace_once(metro, "        this.scheduleClick(context.currentTime + 0.025, true, false, this.settings?.volume ?? 0.55);", "        this.scheduleClick(context.currentTime + 0.025, true, false, this.settings ?? { volume: .55, accentVolume: .82, subdivisionVolume: .3, sound: 'classic', accentSound: 'wood' });", 'resume test click')
metro = replace_once(metro, "  async testClick(): Promise<void> {\n    const context = await this.ensureContext();\n    this.scheduleClick(context.currentTime + 0.025, true, false, this.settings?.volume ?? 0.55);\n  }", "  async testClick(accent = false): Promise<void> {\n    const context = await this.ensureContext();\n    this.scheduleClick(context.currentTime + 0.025, accent, false, this.settings ?? { volume: .55, accentVolume: .82, subdivisionVolume: .3, sound: 'classic', accentSound: 'wood' });\n  }", 'testClick method')
metro = metro.replace("          settings.volume,\n        );", "          settings,\n        );", 1)
# Replace scheduleClick implementation.
click_start = metro.index("  private scheduleClick(\n")
click_end = metro.index("\n  private clearPositionTimers", click_start)
new_click = r'''  private scheduleClick(
    when: number,
    accent: boolean,
    secondary: boolean,
    settings: Pick<MetronomeSettings, 'volume' | 'accentVolume' | 'subdivisionVolume' | 'sound' | 'accentSound'>,
  ): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const sound = accent ? settings.accentSound : settings.sound;
    const config: Record<MetronomeSound, { type: OscillatorType; frequency: number; decay: number }> = {
      classic: { type: 'sine', frequency: 1040, decay: .055 }, wood: { type: 'sine', frequency: 820, decay: .06 },
      rim: { type: 'square', frequency: 1160, decay: .04 }, cowbell: { type: 'triangle', frequency: 560, decay: .09 },
      digital: { type: 'square', frequency: 1480, decay: .027 }, clave: { type: 'triangle', frequency: 1780, decay: .042 },
      shaker: { type: 'sawtooth', frequency: 6200, decay: .024 }, low: { type: 'sine', frequency: 320, decay: .078 },
    };
    const profile = config[sound];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(secondary ? profile.frequency * .72 : profile.frequency, when);
    const volume = accent ? settings.accentVolume : secondary ? settings.subdivisionVolume : settings.volume;
    const level = clamp(volume, 0, 1) * (accent ? .95 : secondary ? .45 : .72);
    const decay = secondary ? Math.min(profile.decay, .032) : profile.decay;
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), when + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, when + decay);
    oscillator.connect(gain); gain.connect(context.destination);
    this.scheduledSources.add(oscillator);
    oscillator.addEventListener('ended', () => { this.scheduledSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }, { once: true });
    oscillator.start(when); oscillator.stop(when + decay + .02);
  }
'''
metro = metro[:click_start] + new_click + metro[click_end:]
write('src/lib/metronome.ts', metro)

# Drummer instruments: 4-piece/5-piece compatible tom layout.
drum = read('src/lib/drummerPractice.ts')
drum = replace_once(drum, "  | 'rackTom'\n  | 'floorTom'", "  | 'rackTom'\n  | 'midTom'\n  | 'floorTom'", 'midTom type')
drum = replace_once(drum, "  { id: 'rackTom', label: '랙 탐', short: 'RT', family: 'drum' },\n  { id: 'floorTom'", "  { id: 'rackTom', label: '스몰 탐', short: 'ST', family: 'drum' },\n  { id: 'midTom', label: '미들 탐', short: 'MT', family: 'drum' },\n  { id: 'floorTom'", 'tom labels')
drum = drum.replace("'마지막 두 박을 랙 탐·플로어 탐·스네어·킥으로 이동하는 기본 필인입니다.'", "'4피스 기준 스몰 탐·플로어 탐·스네어·킥으로 이동하는 기본 필인입니다.'", 1)
insert_after = "  pattern('four-piece-fill',"
idx = drum.index(insert_after)
# Insert 5-piece preset after the existing preset block.
block_end = drum.index("  pattern('five-four-rock'", idx)
five_piece = "  pattern('five-piece-fill', '5피스 탐 필인', '스몰 탐·미들 탐·플로어 탐을 순서대로 내려가는 5피스 필인입니다.', 0.5, {\n    crash: [2],\n    hihat: [0, 0, 1, 0, 1, 0, 1, 0],\n    rackTom: [0, 0, 0, 0, 0, 0, 0, 0, 2, 1],\n    midTom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],\n    floorTom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],\n    snare: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],\n    kick: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2],\n  }),\n"
drum = drum[:block_end] + five_piece + drum[block_end:]
drum = drum.replace('2~12박 한 마디에서 4피스 드럼과 심벌의 각 16분 칸을 편집할 수 있습니다.', '2~12박 한 마디에서 4피스·5피스 드럼과 심벌의 각 16분 칸을 편집할 수 있습니다.')
write('src/lib/drummerPractice.ts', drum)

# Standalone engine: accent sound, click overlay and mid tom.
stand = read('src/lib/standaloneMetronome.ts')
stand = replace_once(stand, "  sound: MetronomeSound;\n  accents: boolean[];", "  sound: MetronomeSound;\n  accentSound?: MetronomeSound;\n  accents: boolean[];\n  clickEnabled?: boolean;\n  clickOverlayEnabled?: boolean;\n  guideSubdivision?: MetronomeSubdivision;", 'standalone settings extension')
stand = replace_once(stand, "  private onAudioState: ((state: MetronomeAudioState) => void) | null = null;", "  private onAudioState: ((state: MetronomeAudioState) => void) | null = null;\n  private onGuideTick: ((beatInBar: number, subdivisionInBeat: number, subdivision: MetronomeSubdivision) => void) | null = null;", 'guide callback property')
stand = replace_once(stand, "    onAudioState?: (state: MetronomeAudioState) => void,\n  ): Promise<void> {", "    onAudioState?: (state: MetronomeAudioState) => void,\n    onGuideTick?: (beatInBar: number, subdivisionInBeat: number, subdivision: MetronomeSubdivision) => void,\n  ): Promise<void> {", 'start callback signature')
stand = replace_once(stand, "    this.onAudioState = onAudioState ?? null;", "    this.onAudioState = onAudioState ?? null;\n    this.onGuideTick = onGuideTick ?? null;", 'start callback assign')
stand = replace_once(stand, "    this.onAudioState = null;", "    this.onAudioState = null;\n    this.onGuideTick = null;", 'stop guide callback')
old_logic = """    if (audible) {\n      if (settings.rhythmEnabled && settings.rhythmPattern && settings.subdivision === 4) {\n        const sounded = this.scheduleDrumPatternStep(when, stepInBar, movingAccent, settings);\n        if (movingAccent && !sounded) this.scheduleClick(when, true, true, settings);\n      } else {\n        this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);\n      }\n    }"""
new_logic = """    if (audible) {\n      if (settings.rhythmEnabled && settings.rhythmPattern && settings.subdivision === 4) {\n        const sounded = this.scheduleDrumPatternStep(when, stepInBar, movingAccent, settings);\n        if (settings.clickOverlayEnabled) this.scheduleGuideOverlay(when, beatInBar, subdivisionInBeat, settings);\n        if (movingAccent && !sounded && !settings.clickOverlayEnabled) this.scheduleClick(when, true, true, settings);\n      } else if (settings.clickEnabled !== false) {\n        this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);\n      }\n    }"""
stand = replace_once(stand, old_logic, new_logic, 'standalone rhythm overlay logic')
insert_at = stand.index("  private scheduleDrumPatternStep(")
guide_methods = r'''  private scheduleGuideOverlay(when: number, beatInBar: number, sixteenthStep: number, settings: StandaloneMetronomeSettings): void {
    const guide = settings.guideSubdivision ?? 1;
    const accentBeat = Boolean(settings.accents[beatInBar]);
    if (guide === 3) {
      if (sixteenthStep !== 0) return;
      const beatDuration = 60 / clamp(settings.bpm, 20, 400);
      for (let index = 0; index < 3; index += 1) {
        const at = when + index * beatDuration / 3;
        this.scheduleClick(at, index === 0 && accentBeat, index > 0, settings);
        this.scheduleGuideTick(at, beatInBar, index, guide);
      }
      return;
    }
    const shouldClick = guide === 1 ? sixteenthStep === 0 : guide === 2 ? sixteenthStep % 2 === 0 : true;
    if (!shouldClick) return;
    const guideStep = guide === 1 ? 0 : guide === 2 ? Math.floor(sixteenthStep / 2) : sixteenthStep;
    this.scheduleClick(when, guideStep === 0 && accentBeat, guideStep > 0, settings);
    this.scheduleGuideTick(when, beatInBar, guideStep, guide);
  }

  private scheduleGuideTick(when: number, beatInBar: number, subdivisionInBeat: number, subdivision: MetronomeSubdivision): void {
    const delay = Math.max(0, (when - (this.context?.currentTime ?? when)) * 1000);
    const timer = window.setTimeout(() => {
      this.tickTimers.delete(timer);
      if (this.running) this.onGuideTick?.(beatInBar, subdivisionInBeat, subdivision);
    }, delay);
    this.tickTimers.add(timer);
  }

'''
stand = stand[:insert_at] + guide_methods + stand[insert_at:]
stand = replace_once(stand, "      rackTom: 0.13,\n      floorTom: 0.16,", "      rackTom: 0.12,\n      midTom: 0.14,\n      floorTom: 0.16,", 'mid tom decay')
stand = replace_once(stand, "    } else if (instrument === 'rackTom') {\n      oscillator.frequency.setValueAtTime(accent ? 235 : 205, when);\n      oscillator.frequency.exponentialRampToValueAtTime(118, when + decay);", "    } else if (instrument === 'midTom') {\n      oscillator.frequency.setValueAtTime(accent ? 195 : 170, when);\n      oscillator.frequency.exponentialRampToValueAtTime(92, when + decay);\n    } else if (instrument === 'rackTom') {\n      oscillator.frequency.setValueAtTime(accent ? 265 : 230, when);\n      oscillator.frequency.exponentialRampToValueAtTime(138, when + decay);", 'mid tom voice')
stand = replace_once(stand, "    const sound = settings.sound;", "    const sound = accent ? settings.accentSound ?? settings.sound : settings.sound;", 'accent sound selection')
write('src/lib/standaloneMetronome.ts', stand)

# Drummer training page settings and audio guide.
page = read('src/pages/DrummerTrainingPage.tsx')
page = replace_once(page, "import BpmNumberInput from '../components/BpmNumberInput';", "import BpmNumberInput from '../components/BpmNumberInput';\nimport SubdivisionCountGuide from '../components/SubdivisionCountGuide';", 'training guide import')
page = replace_once(page, "import { StandaloneMetronomeEngine, type StandaloneMetronomeSettings }", "import { StandaloneMetronomeEngine, type MetronomeSound, type MetronomeSubdivision, type StandaloneMetronomeSettings }", 'training sound types')
page = replace_once(page, "const STORAGE_KEY = 'barloop:drummer-training:v2';", "const STORAGE_KEY = 'barloop:drummer-training:v3';\nconst TRAINING_SOUNDS: MetronomeSound[] = ['classic', 'wood', 'rim', 'cowbell', 'digital', 'clave', 'shaker', 'low'];", 'training storage key')
page = replace_once(page, "  accentFlashEnabled: boolean;", "  accentFlashEnabled: boolean;\n  kitSize: 4 | 5;\n  guideClickEnabled: boolean;\n  guideSubdivision: MetronomeSubdivision;\n  clickVolume: number;\n  accentVolume: number;\n  subdivisionVolume: number;\n  sound: MetronomeSound;\n  accentSound: MetronomeSound;", 'training stored fields')
page = replace_once(page, "  accentFlashEnabled: true,", "  accentFlashEnabled: true,\n  kitSize: 4,\n  guideClickEnabled: true,\n  guideSubdivision: 2,\n  clickVolume: .42,\n  accentVolume: .72,\n  subdivisionVolume: .24,\n  sound: 'classic',\n  accentSound: 'wood',", 'training defaults')
page = replace_once(page, "      accentFlashEnabled: stored.accentFlashEnabled !== false,", "      accentFlashEnabled: stored.accentFlashEnabled !== false,\n      kitSize: stored.kitSize === 5 ? 5 : 4,\n      guideClickEnabled: stored.guideClickEnabled !== false,\n      guideSubdivision: [1, 2, 3, 4].includes(Number(stored.guideSubdivision)) ? Number(stored.guideSubdivision) as MetronomeSubdivision : 2,\n      clickVolume: Math.min(1, Math.max(.05, Number(stored.clickVolume) || .42)),\n      accentVolume: Math.min(1, Math.max(.05, Number(stored.accentVolume) || .72)),\n      subdivisionVolume: Math.min(1, Math.max(0, Number(stored.subdivisionVolume) || .24)),\n      sound: TRAINING_SOUNDS.includes(stored.sound as MetronomeSound) ? stored.sound as MetronomeSound : 'classic',\n      accentSound: TRAINING_SOUNDS.includes(stored.accentSound as MetronomeSound) ? stored.accentSound as MetronomeSound : 'wood',", 'training read fields')
page = replace_once(page, "  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);", "  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);\n  const [kitSize, setKitSize] = useState<4 | 5>(initial.kitSize);\n  const [guideClickEnabled, setGuideClickEnabled] = useState(initial.guideClickEnabled);\n  const [guideSubdivision, setGuideSubdivision] = useState<MetronomeSubdivision>(initial.guideSubdivision);\n  const [clickVolume, setClickVolume] = useState(initial.clickVolume);\n  const [accentVolume, setAccentVolume] = useState(initial.accentVolume);\n  const [subdivisionVolume, setSubdivisionVolume] = useState(initial.subdivisionVolume);\n  const [sound, setSound] = useState<MetronomeSound>(initial.sound);\n  const [accentSound, setAccentSound] = useState<MetronomeSound>(initial.accentSound);\n  const [guideBeatInBar, setGuideBeatInBar] = useState(0);\n  const [guideSubdivisionInBeat, setGuideSubdivisionInBeat] = useState(0);", 'training state')
page = replace_once(page, "    subdivision: 4,\n    volume,\n    accentVolume: Math.min(1, volume + 0.2),\n    subdivisionVolume: volume,", "    subdivision: rhythmEnabled ? 4 : guideSubdivision,\n    volume: clickVolume,\n    accentVolume,\n    subdivisionVolume,", 'training settings subdivision and volume')
page = replace_once(page, "    sound: 'classic',", "    sound,\n    accentSound,", 'training settings sound')
page = replace_once(page, "    rhythmEnabled,", "    clickEnabled: guideClickEnabled,\n    clickOverlayEnabled: rhythmEnabled && guideClickEnabled,\n    guideSubdivision,\n    rhythmEnabled,", 'training click overlay settings')
page = replace_once(page, "  }), [accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, volume]);", "  }), [accentSound, accentTrainerEnabled, accentVolume, bpm, clickVolume, guideClickEnabled, guideSubdivision, movingAccentStep, pattern, rhythmEnabled, sound, subdivisionVolume, volume]);", 'training settings deps')
page = replace_once(page, "      accentFlashEnabled,\n    }));", "      accentFlashEnabled, kitSize, guideClickEnabled, guideSubdivision, clickVolume, accentVolume, subdivisionVolume, sound, accentSound,\n    }));", 'training storage body')
page = replace_once(page, "  }, [accentEveryBars, accentFlashEnabled,", "  }, [accentEveryBars, accentFlashEnabled, accentSound, accentVolume, clickVolume, guideClickEnabled, guideSubdivision, kitSize, sound, subdivisionVolume,", 'training storage deps')
# Add guide callback to engine start call.
page = replace_once(page, "        }),\n      ]);", "        }, undefined, (beat, subdivisionStep) => {\n          setGuideBeatInBar(beat);\n          setGuideSubdivisionInBeat(subdivisionStep);\n        }),\n      ]);", 'training start guide callback')
# Replace quick settings section ending and insert audio settings panel.
quick_end = "        </section>\n\n        <section className=\"panel training-accent-settings\">"
audio_panel = r'''        </section>

        <section className="panel training-audio-settings" aria-label="드럼 트레이닝 클릭 가이드 설정">
          <div className="training-audio-header"><div><span className="eyebrow">CLICK GUIDE</span><h2>클릭 가이드·드럼 구성</h2></div><label className="switch-label"><input type="checkbox" checked={guideClickEnabled} onChange={(event) => setGuideClickEnabled(event.target.checked)} /><span>{guideClickEnabled ? 'ON' : 'OFF'}</span></label></div>
          <div className="training-guide-readout"><span>현재 클릭</span><strong>{guideBeatInBar + 1}{guideSubdivision === 1 ? '' : guideSubdivision === 2 ? guideSubdivisionInBeat === 0 ? '' : ' &' : guideSubdivision === 3 ? ['',' trip',' let'][guideSubdivisionInBeat] : ['',' e',' &',' a'][guideSubdivisionInBeat]}</strong><small>{guideSubdivision === 1 ? '4분음표' : guideSubdivision === 2 ? '8분음표' : guideSubdivision === 3 ? '셋잇단' : '16분음표'}</small></div>
          <SubdivisionCountGuide beatsPerBar={pattern.beatsPerBar} subdivision={guideSubdivision} beatInBar={guideBeatInBar} subdivisionInBeat={guideSubdivisionInBeat} audible={guideClickEnabled} compact />
          <div className="compact-grid three training-settings-grid">
            <label>드럼 구성<select value={kitSize} onChange={(event) => setKitSize(Number(event.target.value) === 5 ? 5 : 4)}><option value={4}>4피스 · 스몰+플로어 탐</option><option value={5}>5피스 · 스몰+미들+플로어 탐</option></select></label>
            <label>클릭 서브디비전<select value={guideSubdivision} onChange={(event) => setGuideSubdivision(Number(event.target.value) as MetronomeSubdivision)}><option value={1}>4분음표</option><option value={2}>8분음표</option><option value={3}>셋잇단</option><option value={4}>16분음표</option></select></label>
            <label>기본 클릭 음색<select value={sound} onChange={(event) => setSound(event.target.value as MetronomeSound)}>{TRAINING_SOUNDS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>강조 클릭 음색<select value={accentSound} onChange={(event) => setAccentSound(event.target.value as MetronomeSound)}>{TRAINING_SOUNDS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>기본 클릭 {Math.round(clickVolume * 100)}%<input type="range" min={.05} max={1} step={.05} value={clickVolume} onChange={(event) => setClickVolume(Number(event.target.value))} /></label>
            <label>강조 클릭 {Math.round(accentVolume * 100)}%<input type="range" min={.05} max={1} step={.05} value={accentVolume} onChange={(event) => setAccentVolume(Number(event.target.value))} /></label>
            <label>세부 박 클릭 {Math.round(subdivisionVolume * 100)}%<input type="range" min={0} max={1} step={.05} value={subdivisionVolume} onChange={(event) => setSubdivisionVolume(Number(event.target.value))} /></label>
          </div>
          <p className="kit-mode-hint">패턴 시퀀서는 계속 16분음표 해상도로 연주하고, 클릭 가이드는 4분·8분·셋잇단·16분 중에서 독립적으로 선택됩니다. 4피스는 스몰 탐과 플로어 탐, 5피스는 미들 탐이 추가됩니다.</p>
        </section>

        <section className="panel training-accent-settings">'''
page = replace_once(page, quick_end, audio_panel, 'training audio panel')
page = replace_once(page, "          pattern={pattern}\n          rhythmEnabled", "          pattern={pattern}\n          kitSize={kitSize}\n          rhythmEnabled", 'training suite kit prop')
write('src/pages/DrummerTrainingPage.tsx', page)

# Drummer suite filters instruments by kit.
suite = read('src/components/DrummerTrainingSuite.tsx')
suite = replace_once(suite, "  pattern: DrumPattern;\n  rhythmEnabled", "  pattern: DrumPattern;\n  kitSize: 4 | 5;\n  rhythmEnabled", 'suite kit prop interface')
suite = replace_once(suite, "  pattern,\n  rhythmEnabled,", "  pattern,\n  kitSize,\n  rhythmEnabled,", 'suite kit destructure')
suite = replace_once(suite, "  const totalSteps = patternStepCount(pattern.beatsPerBar);", "  const totalSteps = patternStepCount(pattern.beatsPerBar);\n  const visibleInstruments = DRUM_INSTRUMENTS.filter((instrument) => kitSize === 5 || instrument.id !== 'midTom');", 'suite visible instruments')
suite = suite.replace('2~12박의 4피스 드럼 세트와 심벌을 직접 편집하고', '2~12박의 4피스·5피스 드럼 세트와 심벌을 직접 편집하고', 1)
suite = replace_once(suite, "          <span>총 {totalSteps}개의 16분 위치</span>", "          <span>총 {totalSteps}개의 16분 위치</span><span>{kitSize}피스 구성</span>", 'suite kit summary')
suite = replace_once(suite, "          {DRUM_INSTRUMENTS.map(({ id, label, short, family }) => (", "          {visibleInstruments.map(({ id, label, short, family }) => (", 'suite instrument filter')
suite = replace_once(suite, "              <div className={`instrument-label ${family}`} title={label}>", "              <div className={`instrument-label ${family}${id === 'midTom' ? ' optional-kit' : ''}`} title={label}>", 'suite midtom class')
write('src/components/DrummerTrainingSuite.tsx', suite)

# Tests for new UX and update old tom label expectations.
practice_test = read('e2e/practice.spec.ts')
practice_test = practice_test.replace("await expect(page.getByText('랙 탐', { exact: true })).toBeVisible();", "await expect(page.getByText('스몰 탐', { exact: true })).toBeVisible();")
write('e2e/practice.spec.ts', practice_test)
write('e2e/video-practice-ux.spec.ts', r'''import { expect, test, type Page } from '@playwright/test';

function createWavBuffer(durationSeconds = 12, sampleRate = 8000): Buffer {
  const samples = Math.round(durationSeconds * sampleRate); const dataLength = samples * 2; const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataLength, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(dataLength, 40); return buffer;
}
async function loadAudio(page: Page) { await page.goto('/'); await page.getByRole('button', { name: '내 영상·음원' }).click(); await page.locator('.drop-zone input[type="file"]').setInputFiles({ name: 'loop.wav', mimeType: 'audio/wav', buffer: createWavBuffer() }); await expect(page.getByText('미디어를 불러왔습니다.', { exact: false })).toBeVisible(); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }

test('bar loop uses A/B sliders and current bar status instead of select boxes', async ({ page }) => {
  await loadAudio(page); await page.locator('#bpm').fill('120'); await page.getByRole('button', { name: '마디 나누기' }).click();
  const picker = page.getByLabel('마디 반복 범위 편집기'); await expect(picker).toBeVisible();
  await expect(picker.getByLabel('A 시작 마디')).toBeVisible(); await expect(picker.getByLabel('B 종료 마디')).toBeVisible();
  await expect(picker.locator('select')).toHaveCount(0); await picker.getByRole('button', { name: '4마디' }).click();
  await expect(picker.getByText('길이 4마디')).toBeVisible(); await noOverflow(page);
});

test('practice mode clearly shows current bar and repeat range', async ({ page }) => {
  await loadAudio(page); await page.getByRole('button', { name: '마디 나누기' }).click(); await page.getByRole('button', { name: '연습 화면' }).click();
  const dialog = page.getByRole('dialog', { name: '드러머 연습 모드' }); await expect(dialog).toBeVisible();
  await expect(dialog.getByText('현재 마디')).toBeVisible(); await expect(dialog.getByText('반복 범위')).toBeVisible(); await expect(dialog.getByText('A부터 다시')).toBeVisible(); await noOverflow(page);
});

test('media metronome separates normal and accent click sounds', async ({ page }) => {
  await page.goto('/'); const panel = page.locator('section.metronome-panel');
  await expect(panel.getByLabel('기본 클릭 음색')).toBeVisible(); await expect(panel.getByLabel('강조 클릭 음색')).toBeVisible();
  await panel.getByLabel('기본 클릭 음색').selectOption('rim'); await panel.getByLabel('강조 클릭 음색').selectOption('cowbell'); await noOverflow(page);
});

test('drum training exposes click subdivision and 4/5 piece kit modes', async ({ page }) => {
  await page.goto('/#drummer-training'); const panel = page.getByLabel('드럼 트레이닝 클릭 가이드 설정');
  await expect(panel.getByLabel('클릭 서브디비전')).toBeVisible(); await panel.getByLabel('클릭 서브디비전').selectOption('3');
  await panel.getByLabel('드럼 구성').selectOption('5'); await expect(page.getByText('미들 탐', { exact: true })).toBeVisible();
  await panel.getByLabel('드럼 구성').selectOption('4'); await expect(page.getByText('미들 탐', { exact: true })).toHaveCount(0); await noOverflow(page);
});
''')

# Service worker cache bump.
sw = read('public/sw.js')
sw = re.sub(r"barloop-shell-v\d+", "barloop-shell-v20", sw, count=1)
write('public/sw.js', sw)

print('Applied video practice UX and drummer training controls.')
