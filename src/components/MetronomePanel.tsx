import type { Subdivision } from '../lib/metronome';
import { getCurrentSubdivisionCount } from '../lib/subdivisionCount';
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
        <span>{countInRemaining !== null ? 'COUNT IN' : audibleBeat ? 'CLICK' : 'GAP'}</span>
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
      <p className="hint">4분음표에서도 1 e & a 격자를 유지하며, 실제 소리가 나는 칸은 점으로 구분합니다.</p>
    </section>
  );
}
