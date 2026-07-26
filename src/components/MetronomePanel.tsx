import type { CountInClickMode, MediaCountMode, Subdivision } from '../lib/metronome';
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
