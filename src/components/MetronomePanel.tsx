import {
  type CountInClickMode,
  type MediaCountMode,
  type Subdivision,
} from '../lib/metronome';
import { isKoreanCountVoiceSupported } from '../lib/koreanCountVoice';
import { getCurrentSubdivisionCount } from '../lib/subdivisionCount';
import { METRONOME_AUDIO_RESUME_EVENT } from '../lib/standaloneMetronome';
import SubdivisionCountGuide from './SubdivisionCountGuide';

interface MetronomePanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  countInBars: number;
  onCountInBarsChange: (bars: number) => void;
  subdivision: Subdivision;
  onSubdivisionChange: (subdivision: Subdivision) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  countMode: MediaCountMode;
  onCountModeChange: (mode: MediaCountMode) => void;
  countInClickMode: CountInClickMode;
  onCountInClickModeChange: (mode: CountInClickMode) => void;
  syncOffsetMs: number;
  onSyncOffsetMsChange: (offsetMs: number) => void;
  gapEnabled: boolean;
  onGapEnabledChange: (enabled: boolean) => void;
  gapPlayBars: number;
  gapMuteBars: number;
  onGapPlayBarsChange: (bars: number) => void;
  onGapMuteBarsChange: (bars: number) => void;
  beatInBar: number;
  subdivisionInBeat: number;
  beatsPerBar: number;
  audibleBeat: boolean;
  countInRemaining: number | null;
}

export default function MetronomePanel({
  enabled,
  onEnabledChange,
  countInBars,
  onCountInBarsChange,
  subdivision,
  onSubdivisionChange,
  volume,
  onVolumeChange,
  countMode,
  onCountModeChange,
  countInClickMode,
  onCountInClickModeChange,
  syncOffsetMs,
  onSyncOffsetMsChange,
  gapEnabled,
  onGapEnabledChange,
  gapPlayBars,
  gapMuteBars,
  onGapPlayBarsChange,
  onGapMuteBarsChange,
  beatInBar,
  subdivisionInBeat,
  beatsPerBar,
  audibleBeat,
  countInRemaining,
}: MetronomePanelProps) {
  const currentCount = getCurrentSubdivisionCount(beatInBar, subdivisionInBeat, subdivision);
  const voiceSupported = isKoreanCountVoiceSupported();
  const outputLabel = countMode === 'voice' ? 'VOICE' : countMode === 'both' ? 'BOTH' : 'CLICK';
  const statusLabel = countInRemaining !== null
    ? 'COUNT IN'
    : !enabled
      ? 'GUIDE'
      : audibleBeat
        ? outputLabel
        : 'GAP';

  return (
    <section className="panel tool-panel metronome-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">CLICK</span>
          <h2>메트로놈·카운트인</h2>
        </div>
        <label className="switch-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>{enabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>

      <div className="metronome-count-readout">
        <strong>{currentCount}</strong>
        <span>{statusLabel}</span>
      </div>

      <SubdivisionCountGuide
        beatsPerBar={beatsPerBar}
        subdivision={subdivision}
        beatInBar={beatInBar}
        subdivisionInBeat={subdivisionInBeat}
        audible={audibleBeat}
        compact
      />

      {countInRemaining !== null && (
        <div className="count-in-banner" role="status">
          카운트인 <strong>{countInRemaining}</strong>박 남음 · 현재 <strong>{currentCount}</strong>
        </div>
      )}

      <div className="compact-grid three">
        <label>
          카운트인
          <select value={countInBars} onChange={(event) => onCountInBarsChange(Number(event.target.value))}>
            <option value={0}>없음</option>
            <option value={1}>1마디</option>
            <option value={2}>2마디</option>
            <option value={4}>4마디</option>
          </select>
        </label>
        <label>
          서브디비전
          <select
            value={subdivision}
            onChange={(event) => onSubdivisionChange(Number(event.target.value) as Subdivision)}
          >
            <option value={1}>4분음표</option>
            <option value={2}>8분음표</option>
            <option value={3}>셋잇단</option>
            <option value={4}>16분음표</option>
          </select>
        </label>
        <label>
          클릭 음량 {Math.round(volume * 100)}%
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="media-count-options">
        <label>
          메인 박 출력
          <select
            value={countMode}
            onChange={(event) => onCountModeChange(event.target.value as MediaCountMode)}
          >
            <option value="click">클릭음</option>
            <option value="voice">한국어 카운트</option>
            <option value="both">클릭 + 한국어 카운트</option>
          </select>
        </label>
        <label>
          카운트인 클릭
          <select
            value={countInClickMode}
            onChange={(event) => onCountInClickModeChange(event.target.value as CountInClickMode)}
          >
            <option value="beat">숫자 박만 클릭</option>
            <option value="subdivision">선택한 모든 칸 클릭</option>
          </select>
        </label>
      </div>
      {!voiceSupported && countMode !== 'click' && (
        <p className="hint">이 브라우저에서는 한국어 시스템 음성을 찾지 못해 클릭음으로 자동 대체됩니다.</p>
      )}

      <div className="sync-offset-control">
        <div className="label-row">
          <label htmlFor="media-click-sync">클릭 싱크 보정</label>
          <strong>{syncOffsetMs > 0 ? '+' : ''}{syncOffsetMs}ms</strong>
        </div>
        <input
          id="media-click-sync"
          type="range"
          min={-200}
          max={200}
          step={5}
          value={syncOffsetMs}
          onChange={(event) => onSyncOffsetMsChange(Number(event.target.value))}
        />
        <div className="sync-offset-actions">
          <button type="button" onClick={() => onSyncOffsetMsChange(Math.max(-200, syncOffsetMs - 10))}>−10ms</button>
          <button type="button" onClick={() => onSyncOffsetMsChange(0)}>0으로</button>
          <button type="button" onClick={() => onSyncOffsetMsChange(Math.min(200, syncOffsetMs + 10))}>+10ms</button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(METRONOME_AUDIO_RESUME_EVENT))}
          >
            소리 테스트
          </button>
        </div>
        <p className="hint">음수가 클릭을 앞당기고, 양수가 클릭을 늦춥니다. 블루투스 출력 지연에 맞춰 조절하세요.</p>
      </div>

      <div className="gap-click-row">
        <label className="switch-label">
          <input
            type="checkbox"
            checked={gapEnabled}
            onChange={(event) => onGapEnabledChange(event.target.checked)}
          />
          <span>Gap Click</span>
        </label>
        <label>
          소리
          <input
            type="number"
            min={1}
            max={16}
            value={gapPlayBars}
            onChange={(event) => onGapPlayBarsChange(Number(event.target.value))}
          />
          마디
        </label>
        <label>
          무음
          <input
            type="number"
            min={1}
            max={16}
            value={gapMuteBars}
            onChange={(event) => onGapMuteBarsChange(Number(event.target.value))}
          />
          마디
        </label>
      </div>
      <p className="hint">화면의 `1 e & a`는 메트로놈을 꺼도 영상 시간에 맞춰 계속 움직입니다.</p>
    </section>
  );
}
