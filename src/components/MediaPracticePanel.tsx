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
          <h2>원곡 음량과 반복 진입</h2>
        </div>
        <span className="status-chip">원곡 {Math.round(mediaVolume * 100)}%</span>
      </div>

      <label>
        원곡·영상 재생 음량 {Math.round(mediaVolume * 100)}%
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={mediaVolume}
          onChange={(event) => onMediaVolumeChange(Number(event.target.value))}
        />
      </label>
      <p className="hint">메트로놈 음량과는 별개로, 연습할 원곡이나 영상 자체의 소리만 조절합니다.</p>

      <div className="compact-grid two">
        <label>
          A 구간 시작 전 미리 재생
          <select value={preRollBeats} onChange={(event) => onPreRollBeatsChange(Number(event.target.value))}>
            <option value={0}>바로 A 지점부터</option>
            <option value={1}>1박 앞에서</option>
            <option value={beatsPerBar}>1마디 앞에서</option>
            <option value={beatsPerBar * 2}>2마디 앞에서</option>
          </select>
        </label>
        <button type="button" className="secondary-button entry-play-button" disabled={disabled} onClick={onPlayPreRoll}>
          미리 듣고 A 구간 진입
        </button>
      </div>
      <p className="hint">
        선택한 A 반복 구간보다 약 {preRollSeconds.toFixed(2)}초 앞에서 한 번 재생해 손과 자세를 준비합니다. 반복 횟수는 A 지점에 도착한 뒤부터 계산됩니다.
      </p>

      <div className="fill-trainer-row">
        <div><strong>Fill Trainer</strong><span>선택한 시작 마디부터 그루브와 필인 연습 범위를 빠르게 만듭니다.</span></div>
        <button type="button" disabled={!canUseBars} onClick={() => onFillPreset(3)}>3 Groove + 1 Fill</button>
        <button type="button" disabled={!canUseBars} onClick={() => onFillPreset(7)}>7 Groove + 1 Fill</button>
      </div>
    </section>
  );
}
