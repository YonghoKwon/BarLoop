import {
  DEFAULT_ROUTINE,
  DRUM_INSTRUMENTS,
  GROOVE_PATTERNS,
  clonePattern,
  cycleStepLevel,
  routineTotalBars,
  type DrumInstrument,
  type DrumPattern,
  type PracticeRoutineStep,
} from '../lib/drummerPractice';

interface DrummerTrainingSuiteProps {
  pattern: DrumPattern;
  rhythmEnabled: boolean;
  activeStep: number;
  onPatternChange: (pattern: DrumPattern) => void;
  onApplyGroove: (pattern: DrumPattern) => void;
  onRhythmEnabledChange: (enabled: boolean) => void;
  accentTrainerEnabled: boolean;
  accentEveryBars: number;
  accentMode: 'forward' | 'random';
  movingAccentStep: number;
  onAccentTrainerChange: (enabled: boolean) => void;
  onAccentEveryBarsChange: (bars: number) => void;
  onAccentModeChange: (mode: 'forward' | 'random') => void;
  routineSteps: PracticeRoutineStep[];
  routineRunning: boolean;
  routineIndex: number;
  routineBarInStep: number;
  onRoutineChange: (steps: PracticeRoutineStep[]) => void;
  onStartRoutine: () => void;
  onStopRoutine: () => void;
}

const SUBDIVISION_LABELS = ['숫자', 'e', '&', 'a'];

function countLabel(index: number): string {
  const beat = Math.floor(index / 4) + 1;
  return [String(beat), 'e', '&', 'a'][index % 4];
}

export default function DrummerTrainingSuite({
  pattern,
  rhythmEnabled,
  activeStep,
  onPatternChange,
  onApplyGroove,
  onRhythmEnabledChange,
  accentTrainerEnabled,
  accentEveryBars,
  accentMode,
  movingAccentStep,
  onAccentTrainerChange,
  onAccentEveryBarsChange,
  onAccentModeChange,
  routineSteps,
  routineRunning,
  routineIndex,
  routineBarInStep,
  onRoutineChange,
  onStartRoutine,
  onStopRoutine,
}: DrummerTrainingSuiteProps) {
  const updateCell = (instrument: DrumInstrument, stepIndex: number) => {
    const next = clonePattern(pattern, 'custom', '내 커스텀 패턴');
    next.steps[instrument][stepIndex] = cycleStepLevel(next.steps[instrument][stepIndex]);
    onPatternChange(next);
  };

  const clearPattern = () => {
    const next = clonePattern(pattern, 'custom', '내 커스텀 패턴');
    DRUM_INSTRUMENTS.forEach(({ id }) => {
      next.steps[id] = next.steps[id].map(() => 0);
    });
    onPatternChange(next);
  };

  const updateRoutine = (index: number, patch: Partial<PracticeRoutineStep>) => {
    onRoutineChange(
      routineSteps.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step),
    );
  };

  const removeRoutineStep = (index: number) => {
    if (routineSteps.length <= 1) return;
    onRoutineChange(routineSteps.filter((_, itemIndex) => itemIndex !== index));
  };

  const addRoutineStep = () => {
    const id = `step-${Date.now()}`;
    onRoutineChange([
      ...routineSteps,
      {
        id,
        name: `단계 ${routineSteps.length + 1}`,
        bpm: 90,
        bars: 8,
        patternId: 'basic-rock',
        accentTrainer: false,
      },
    ]);
  };

  return (
    <section className="drummer-training-suite">
      <div className="training-suite-title panel">
        <div>
          <span className="eyebrow">DRUMMER TRAINING</span>
          <h2>리듬·루틴 트레이닝</h2>
          <p className="subtle">4피스 드럼 세트와 심벌을 직접 편집하고 여러 연습 단계를 자동으로 이어 갑니다.</p>
        </div>
        <label className="switch-label">
          <input
            type="checkbox"
            checked={rhythmEnabled}
            onChange={(event) => onRhythmEnabledChange(event.target.checked)}
          />
          <span>그루브 소리</span>
        </label>
      </div>

      <section className="panel training-feature-block" aria-label="그루브 패턴 메트로놈">
        <div className="feature-heading">
          <div>
            <strong>그루브 패턴 메트로놈</strong>
            <span>킥·스네어·탐·하이햇·라이드·크래시를 실제 드럼 파트처럼 조합합니다.</span>
          </div>
          <span className="status-chip">{pattern.name}</span>
        </div>
        <div className="groove-preset-grid">
          {GROOVE_PATTERNS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={pattern.id === preset.id ? 'active' : ''}
              onClick={() => onApplyGroove(clonePattern(preset))}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel training-feature-block sequence-editor" aria-label="커스텀 리듬 시퀀서">
        <div className="feature-heading">
          <div>
            <strong>커스텀 16칸 시퀀서</strong>
            <span>한 마디를 1·2·3·4박으로 나누고, 각 박의 1 e & a를 개별 편집합니다.</span>
          </div>
          <button type="button" className="secondary-button" onClick={clearPattern}>전체 지우기</button>
        </div>

        <div className="sequencer-legend" aria-hidden="true">
          <span><i className="legend-dot normal" />일반 타격</span>
          <span><i className="legend-dot accent" />강세 타격</span>
          <span><i className="legend-dot playhead" />현재 위치</span>
        </div>

        <div className="drum-sequencer-grid">
          {DRUM_INSTRUMENTS.map(({ id, label, short, family }) => (
            <div className="drum-sequence-row" key={id}>
              <div className={`instrument-label ${family}`} title={label}>
                <strong>{short}</strong>
                <span>{label}</span>
              </div>
              <div className="drum-beat-groups">
                {Array.from({ length: 4 }, (_, beatIndex) => (
                  <section className="drum-beat-group" key={beatIndex} aria-label={`${beatIndex + 1}박`}>
                    <div className="drum-beat-heading">
                      <strong>{beatIndex + 1}박</strong>
                      <span>{beatIndex * 4 + 1}–{beatIndex * 4 + 4}칸</span>
                    </div>
                    <div className="drum-substep-labels" aria-hidden="true">
                      {SUBDIVISION_LABELS.map((labelText, subIndex) => (
                        <span key={labelText}>{subIndex === 0 ? beatIndex + 1 : labelText}</span>
                      ))}
                    </div>
                    <div className="drum-substep-grid">
                      {Array.from({ length: 4 }, (_, subIndex) => {
                        const stepIndex = beatIndex * 4 + subIndex;
                        const level = pattern.steps[id][stepIndex];
                        return (
                          <button
                            key={stepIndex}
                            type="button"
                            className={[
                              level === 2 ? 'accent' : level === 1 ? 'on' : '',
                              activeStep === stepIndex ? 'playhead' : '',
                            ].filter(Boolean).join(' ')}
                            aria-label={`${label} ${countLabel(stepIndex)} ${level === 2 ? '강세' : level === 1 ? '일반' : '무음'}`}
                            onClick={() => updateCell(id, stepIndex)}
                          >
                            {level === 2 ? '●' : level === 1 ? '·' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="sequencer-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onApplyGroove(clonePattern(pattern, 'custom', '내 커스텀 패턴'))}
          >
            커스텀 패턴 적용
          </button>
          <span>각 칸은 무음 → 일반 → 강세 순서로 변경됩니다.</span>
        </div>
      </section>

      <section className="panel training-feature-block accent-mover" aria-label="악센트 이동 트레이너">
        <div className="feature-heading">
          <div>
            <strong>악센트 이동 트레이너</strong>
            <span>16분음표 강세가 일정 마디마다 다음 위치 또는 무작위 위치로 이동합니다.</span>
          </div>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={accentTrainerEnabled}
              onChange={(event) => onAccentTrainerChange(event.target.checked)}
            />
            <span>사용</span>
          </label>
        </div>
        <div className="accent-trainer-controls">
          <label>이동 주기
            <select value={accentEveryBars} onChange={(event) => onAccentEveryBarsChange(Number(event.target.value))}>
              <option value={1}>1마디마다</option>
              <option value={2}>2마디마다</option>
              <option value={4}>4마디마다</option>
              <option value={8}>8마디마다</option>
            </select>
          </label>
          <label>이동 방식
            <select value={accentMode} onChange={(event) => onAccentModeChange(event.target.value as 'forward' | 'random')}>
              <option value="forward">앞으로 순환</option>
              <option value="random">무작위</option>
            </select>
          </label>
          <div className="moving-accent-readout"><span>현재 강세</span><strong>{countLabel(movingAccentStep)}</strong></div>
        </div>
        <div className="accent-position-strip">
          {Array.from({ length: 16 }, (_, index) => (
            <i key={index} className={index === movingAccentStep ? 'active' : ''}>{countLabel(index)}</i>
          ))}
        </div>
      </section>

      <section className="panel training-feature-block routine-builder" aria-label="연습 루틴 빌더">
        <div className="feature-heading">
          <div>
            <strong>연습 루틴 빌더</strong>
            <span>BPM·마디 수·그루브·악센트 이동을 단계별로 저장하고 자동 진행합니다.</span>
          </div>
          <span className="status-chip">총 {routineTotalBars(routineSteps)}마디</span>
        </div>
        <div className="routine-step-list">
          {routineSteps.map((step, index) => (
            <div key={step.id} className={routineRunning && index === routineIndex ? 'routine-step active' : 'routine-step'}>
              <span className="routine-index">{index + 1}</span>
              <label>이름<input value={step.name} onChange={(event) => updateRoutine(index, { name: event.target.value })} /></label>
              <label>BPM<input type="number" min={20} max={400} value={step.bpm} onChange={(event) => updateRoutine(index, { bpm: Number(event.target.value) })} /></label>
              <label>마디<input type="number" min={1} max={128} value={step.bars} onChange={(event) => updateRoutine(index, { bars: Number(event.target.value) })} /></label>
              <label>그루브
                <select value={step.patternId} onChange={(event) => updateRoutine(index, { patternId: event.target.value })}>
                  {GROOVE_PATTERNS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                  <option value="custom">내 커스텀</option>
                </select>
              </label>
              <label className="routine-accent">
                <input type="checkbox" checked={step.accentTrainer} onChange={(event) => updateRoutine(index, { accentTrainer: event.target.checked })} />
                악센트 이동
              </label>
              <button type="button" className="routine-remove" onClick={() => removeRoutineStep(index)} aria-label={`${step.name} 삭제`}>×</button>
              {routineRunning && index === routineIndex && (
                <div className="routine-current">{Math.min(step.bars, routineBarInStep + 1)} / {step.bars}마디</div>
              )}
            </div>
          ))}
        </div>
        <div className="routine-actions">
          <button type="button" className="secondary-button" disabled={routineRunning} onClick={addRoutineStep}>단계 추가</button>
          <button
            type="button"
            className="secondary-button"
            disabled={routineRunning}
            onClick={() => onRoutineChange(DEFAULT_ROUTINE.map((step) => ({ ...step })))}
          >
            기본 루틴 복원
          </button>
          {routineRunning
            ? <button type="button" className="danger-button" onClick={onStopRoutine}>루틴 중지</button>
            : <button type="button" className="primary-button" onClick={onStartRoutine}>루틴 자동 시작</button>}
        </div>
      </section>
    </section>
  );
}
