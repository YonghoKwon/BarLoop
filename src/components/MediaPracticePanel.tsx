interface MediaPracticePanelProps {
  mediaVolume: number;
  onMediaVolumeChange: (value: number) => void;
  preRollBeats: number;
  onPreRollBeatsChange: (value: number) => void;
  beatsPerBar: number;
  bpm: number;
  disabled: boolean;
  canUseBars: boolean;
  onPlayPreRoll: () => void;
  onFillPreset: (grooveBars: 3 | 7) => void;
}

export default function MediaPracticePanel({
  mediaVolume,
  onMediaVolumeChange,
  preRollBeats,
  onPreRollBeatsChange,
  beatsPerBar,
  bpm,
  disabled,
  canUseBars,
  onPlayPreRoll,
  onFillPreset,
}: MediaPracticePanelProps) {
  const preRollSeconds = bpm > 0 ? preRollBeats * 60 / bpm : 0;

  return (
    <section className="panel tool-panel media-practice-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">MIX & ENTRY</span>
          <h2>원곡 믹서와 프리롤</h2>
        </div>
        <span className="status-chip">{Math.round(mediaVolume * 100)}%</span>
      </div>

      <label>
        원곡·영상 음량 {Math.round(mediaVolume * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={mediaVolume}
          onChange={(event) => onMediaVolumeChange(Number(event.target.value))}
        />
      </label>

      <div className="compact-grid two">
        <label>
          반복 진입 여유
          <select value={preRollBeats} onChange={(event) => onPreRollBeatsChange(Number(event.target.value))}>
            <option value={0}>A 지점부터</option>
            <option value={1}>1박 전</option>
            <option value={beatsPerBar}>1마디 전</option>
            <option value={beatsPerBar * 2}>2마디 전</option>
          </select>
        </label>
        <button type="button" className="secondary-button entry-play-button" disabled={disabled} onClick={onPlayPreRoll}>
          프리롤부터 재생
        </button>
      </div>
      <p className="hint">현재 BPM 기준 약 {preRollSeconds.toFixed(2)}초 앞에서 시작하며 반복 횟수는 A 지점부터 계산합니다.</p>

      <div className="fill-trainer-row">
        <div><strong>Fill Trainer</strong><span>선택한 시작 마디부터 빠르게 범위를 구성합니다.</span></div>
        <button type="button" disabled={!canUseBars} onClick={() => onFillPreset(3)}>3 Groove + 1 Fill</button>
        <button type="button" disabled={!canUseBars} onClick={() => onFillPreset(7)}>7 Groove + 1 Fill</button>
      </div>
    </section>
  );
}
