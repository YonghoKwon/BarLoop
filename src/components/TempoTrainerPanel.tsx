import BpmNumberInput from './BpmNumberInput';

export interface TempoTrainerSettings {
  enabled: boolean;
  startBpm: number;
  targetBpm: number;
  stepBpm: number;
  repeatsPerStep: number;
  restSeconds: number;
}

interface TempoTrainerPanelProps {
  settings: TempoTrainerSettings;
  currentBpm: number | null;
  baseBpm: number;
  active: boolean;
  onChange: (settings: TempoTrainerSettings) => void;
  onStart: () => void;
  onStop: () => void;
}

export default function TempoTrainerPanel({
  settings,
  currentBpm,
  baseBpm,
  active,
  onChange,
  onStart,
  onStop,
}: TempoTrainerPanelProps) {
  const update = <K extends keyof TempoTrainerSettings>(key: K, value: TempoTrainerSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const plannedRate = baseBpm > 0 ? settings.startBpm / baseBpm : 1;

  return (
    <section className="panel tool-panel trainer-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">TRAINER</span>
          <h2>템포 트레이너</h2>
        </div>
        <span className={active ? 'status-chip active' : 'status-chip'}>
          {active ? `${currentBpm ?? settings.startBpm} BPM` : '대기'}
        </span>
      </div>

      <div className="compact-grid three">
        <label>
          시작 BPM
          <BpmNumberInput
            value={settings.startBpm}
            onChange={(value) => update('startBpm', value)}
            ariaLabel="템포 트레이너 시작 BPM"
          />
        </label>
        <label>
          목표 BPM
          <BpmNumberInput
            value={settings.targetBpm}
            onChange={(value) => update('targetBpm', value)}
            ariaLabel="템포 트레이너 목표 BPM"
          />
        </label>
        <label>
          증가 폭
          <input
            type="number"
            min={1}
            max={30}
            value={settings.stepBpm}
            onChange={(event) => update('stepBpm', Number(event.target.value))}
          />
        </label>
        <label>
          단계당 반복
          <input
            type="number"
            min={1}
            max={100}
            value={settings.repeatsPerStep}
            onChange={(event) => update('repeatsPerStep', Number(event.target.value))}
          />
        </label>
        <label>
          단계 휴식
          <select
            value={settings.restSeconds}
            onChange={(event) => update('restSeconds', Number(event.target.value))}
          >
            <option value={0}>없음</option>
            <option value={2}>2초</option>
            <option value={5}>5초</option>
            <option value={10}>10초</option>
          </select>
        </label>
        <label className="switch-label trainer-switch">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => update('enabled', event.target.checked)}
          />
          <span>반복 시 자동 증가</span>
        </label>
      </div>

      <p className="hint">
        원곡 {baseBpm || '-'} BPM을 기준으로 재생 속도를 자동 조절합니다. 시작 속도는 약{' '}
        {Math.round(plannedRate * 100)}%입니다.
      </p>

      <div className="button-row">
        <button type="button" className="primary-button" disabled={active} onClick={onStart}>
          트레이너 시작
        </button>
        <button type="button" className="secondary-button" disabled={!active} onClick={onStop}>
          중지
        </button>
      </div>
    </section>
  );
}
