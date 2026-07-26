import type { CSSProperties } from 'react';
import {
  DEFAULT_ROUTINE,
  DRUM_INSTRUMENTS,
  GROOVE_PATTERNS,
  clonePattern,
  cycleStepLevel,
  patternStepCount,
  routineTotalBars,
  type DrumInstrument,
  type DrumPattern,
  type PracticeRoutineStep,
} from '../lib/drummerPractice';

interface DrummerTrainingSuiteProps {
  pattern: DrumPattern;
  kitSize: 4 | 5;
  rhythmEnabled: boolean;
  activeStep: number;
  onPatternChange: (pattern: DrumPattern) => void;
  onApplyGroove: (pattern: DrumPattern) => void;
  onBeatsPerBarChange: (beatsPerBar: number) => void;
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

const SUBDIVISION_LABELS = ['정박', 'e', '&', 'a'];

function countLabel(index: number): string {
  const beat = Math.floor(index / 4) + 1;
  return [String(beat), 'e', '&', 'a'][index % 4];
}

function meterGroupingLabel(beatsPerBar: number): string {
  const groups: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '3+2', 6: '3+3', 7: '4+3', 8: '4+4',
    9: '3+3+3', 10: '5+5', 11: '4+4+3', 12: '4+4+4',
  };
  return groups[beatsPerBar] ?? String(beatsPerBar);
}

export default function DrummerTrainingSuite({
  pattern,
  kitSize,
  rhythmEnabled,
  activeStep,
  onPatternChange,
  onApplyGroove,
  onBeatsPerBarChange,
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
  const totalSteps = patternStepCount(pattern.beatsPerBar);
  const visibleInstruments = DRUM_INSTRUMENTS.filter((instrument) => kitSize === 5 || instrument.id !== 'midTom');
  const beatColumns = Math.min(4, pattern.beatsPerBar);
  const meterStyle = { '--beat-columns': beatColumns } as CSSProperties;
  const accentStyle = { '--accent-columns': Math.min(16, totalSteps) } as CSSProperties;

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

  const applySyncopationTemplate = (mode: 'eighth' | 'sixteenth') => {
    const next = clonePattern(pattern, 'custom', mode === 'eighth' ? '내 8분 엇박 패턴' : '내 16분 엇박 패턴');
    DRUM_INSTRUMENTS.forEach(({ id }) => {
      next.steps[id] = next.steps[id].map(() => 0);
    });

    for (let beat = 0; beat < pattern.beatsPerBar; beat += 1) {
      const start = beat * 4;
      if (mode === 'eighth') {
        next.steps.hihat[start + 2] = beat === 0 ? 2 : 1;
        if (beat % 2 === 1) next.steps.kick[start + 2] = 1;
      } else {
        next.steps.hihat[start] = beat === 0 ? 2 : 1;
        next.steps.hihat[start + 1] = 1;
        next.steps.hihat[start + 2] = 2;
        next.steps.hihat[start + 3] = 1;
        if (beat % 2 === 0) next.steps.kick[start + 3] = 1;
        else next.steps.kick[start + 1] = 1;
      }

      if (beat === 1 || beat === 3 || (pattern.beatsPerBar > 4 && beat === pattern.beatsPerBar - 1)) {
        next.steps.snare[start] = 2;
      }
    }
    next.steps.kick[0] = 2;
    next.description = mode === 'eighth'
      ? `${pattern.beatsPerBar}/4의 모든 & 위치를 중심으로 만든 8분 엇박 패턴`
      : `${pattern.beatsPerBar}/4의 e·&·a를 번갈아 사용하는 16분 싱코페이션 패턴`;
    onPatternChange(next);
  };

  const updateRoutine = (index: number, patch: Partial<PracticeRoutineStep>) => {
    onRoutineChange(routineSteps.map((step, itemIndex) => itemIndex === index ? { ...step, ...patch } : step));
  };

  const removeRoutineStep = (index: number) => {
    if (routineSteps.length <= 1) return;
    onRoutineChange(routineSteps.filter((_, itemIndex) => itemIndex !== index));
  };

  const addRoutineStep = () => {
    onRoutineChange([
      ...routineSteps,
      {
        id: `step-${Date.now()}`,
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
          <p className="subtle">2~12박의 4피스·5피스 드럼 세트와 심벌을 직접 편집하고 엇박·홀수 박자 루틴을 자동으로 이어 갑니다.</p>
        </div>
        <label className="switch-label">
          <input type="checkbox" checked={rhythmEnabled} onChange={(event) => onRhythmEnabledChange(event.target.checked)} />
          <span>그루브 소리</span>
        </label>
      </div>

      <section className="panel training-feature-block" aria-label="그루브 패턴 메트로놈">
        <div className="feature-heading">
          <div>
            <strong>그루브 패턴 메트로놈</strong>
            <span>기본 4/4뿐 아니라 5/4·7/4와 8분·16분 엇박 프리셋을 바로 적용합니다.</span>
          </div>
          <span className="status-chip">{pattern.beatsPerBar}/4 · {pattern.name}</span>
        </div>
        <div className="groove-preset-grid">
          {GROOVE_PATTERNS.map((preset) => (
            <button key={preset.id} type="button" className={pattern.id === preset.id ? 'active' : ''} onClick={() => onApplyGroove(clonePattern(preset))}>
              <strong>{preset.name}</strong>
              <span>{preset.beatsPerBar}/4 · {preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel training-feature-block sequence-editor" aria-label="커스텀 리듬 시퀀서">
        <div className="feature-heading sequence-heading">
          <div>
            <strong>커스텀 {totalSteps}칸 시퀀서</strong>
            <span>{pattern.beatsPerBar}박 × 1 e & a. 박 수를 바꾸면 기존 패턴을 보존하면서 칸이 자동으로 늘어나거나 줄어듭니다.</span>
          </div>
          <div className="sequence-heading-actions">
            <label>한 마디 박자
              <select aria-label="드럼 시퀀서 박자 수" value={pattern.beatsPerBar} onChange={(event) => onBeatsPerBarChange(Number(event.target.value))}>
                {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => (
                  <option key={value} value={value}>{value}/4 · {value * 4}칸</option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" onClick={clearPattern}>전체 지우기</button>
          </div>
        </div>

        <div className="sequencer-meter-summary">
          <strong>{pattern.beatsPerBar}/4</strong>
          <span>추천 묶음 {meterGroupingLabel(pattern.beatsPerBar)}</span>
          <span>총 {totalSteps}개의 16분 위치</span><span>{kitSize}피스 구성</span>
        </div>

        <div className="syncopation-actions">
          <div>
            <strong>엇박 빠른 만들기</strong>
            <span>&는 박과 박 사이의 8분 엇박이고, e·a는 그보다 더 잘게 나눈 16분 사이 위치입니다. 정박 악기를 남겨 두는 것은 박을 잃지 않기 위한 기준점입니다.</span>
          </div>
          <button type="button" onClick={() => applySyncopationTemplate('eighth')}>모든 &에 8분 엇박</button>
          <button type="button" onClick={() => applySyncopationTemplate('sixteenth')}>e·&·a 싱코페이션</button>
        </div>

        <div className="syncopation-explainer" aria-label="엇박 이해하기">
          <div className="downbeat-card"><strong>1 · 2 · 3 · 4</strong><span>정박 · 숫자를 세는 기본 박</span></div>
          <div className="eighth-card"><strong>1 & 2 & 3 & 4 &</strong><span>8분 엇박 · 각 박의 정확한 중간</span></div>
          <div className="sixteenth-card"><strong>1 e & a</strong><span>16분 사이 · e와 a는 더 세밀한 싱코페이션 위치</span></div>
        </div>

        <div className="sequencer-legend" aria-hidden="true">
          <span><i className="legend-dot normal" />일반 타격</span>
          <span><i className="legend-dot accent" />강세 타격</span>
          <span><i className="legend-dot downbeat" />정박·숫자</span>
          <span><i className="legend-dot eighth-offbeat" />8분 엇박·&</span>
          <span><i className="legend-dot sixteenth-between" />16분 사이·e/a</span>
          <span><i className="legend-dot playhead" />현재 위치</span>
        </div>

        <div className="drum-sequencer-grid">
          {visibleInstruments.map(({ id, label, short, family }) => (
            <div className="drum-sequence-row" key={id}>
              <div className={`instrument-label ${family}${id === 'midTom' ? ' optional-kit' : ''}`} title={label}>
                <strong>{short}</strong>
                <span>{label}</span>
              </div>
              <div className="drum-beat-groups" style={meterStyle}>
                {Array.from({ length: pattern.beatsPerBar }, (_, beatIndex) => (
                  <section className="drum-beat-group" key={beatIndex} aria-label={`${beatIndex + 1}박`}>
                    <div className="drum-beat-heading"><strong>{beatIndex + 1}박</strong><span>{beatIndex * 4 + 1}–{beatIndex * 4 + 4}칸</span></div>
                    <div className="drum-substep-labels" aria-hidden="true">
                      {SUBDIVISION_LABELS.map((labelText, subIndex) => (
                        <span key={labelText} className={subIndex === 0 ? 'downbeat-label' : subIndex === 2 ? 'eighth-offbeat-label' : 'sixteenth-between-label'}>{subIndex === 0 ? beatIndex + 1 : labelText}</span>
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
                              subIndex > 0 ? 'offbeat-cell' : 'downbeat-cell',
                              subIndex === 2 ? 'ampersand-cell' : '',
                              subIndex === 2 ? 'eighth-offbeat-cell' : subIndex > 0 ? 'sixteenth-between-cell' : '',
                              level === 2 ? 'accent' : level === 1 ? 'on' : '',
                              activeStep === stepIndex ? 'playhead' : '',
                            ].filter(Boolean).join(' ')}
                            aria-label={`${label} ${countLabel(stepIndex)} ${subIndex === 0 ? '정박' : subIndex === 2 ? '8분 엇박' : '16분 사이'} ${level === 2 ? '강세' : level === 1 ? '일반' : '무음'}`}
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
          <button type="button" className="primary-button" onClick={() => onApplyGroove(clonePattern(pattern, 'custom', '내 커스텀 패턴'))}>커스텀 패턴 적용</button>
          <span>각 칸은 무음 → 일반 → 강세 순서로 변경됩니다. 흐린 배경은 e·&·a 엇박 위치입니다.</span>
        </div>
      </section>

      <section className="panel training-feature-block accent-mover" aria-label="악센트 이동 트레이너">
        <div className="feature-heading">
          <div><strong>악센트 이동 트레이너</strong><span>{totalSteps}개의 16분 위치를 순환하며 정박과 엇박 사이로 강세를 이동합니다.</span></div>
          <label className="switch-label"><input type="checkbox" checked={accentTrainerEnabled} onChange={(event) => onAccentTrainerChange(event.target.checked)} /><span>사용</span></label>
        </div>
        <div className="accent-trainer-controls">
          <label>이동 주기<select value={accentEveryBars} onChange={(event) => onAccentEveryBarsChange(Number(event.target.value))}><option value={1}>1마디마다</option><option value={2}>2마디마다</option><option value={4}>4마디마다</option><option value={8}>8마디마다</option></select></label>
          <label>이동 방식<select value={accentMode} onChange={(event) => onAccentModeChange(event.target.value as 'forward' | 'random')}><option value="forward">앞으로 순환</option><option value="random">무작위</option></select></label>
          <div className="moving-accent-readout"><span>현재 강세</span><strong>{countLabel(movingAccentStep)}</strong><small>{movingAccentStep % 4 === 0 ? '정박' : '엇박'}</small></div>
        </div>
        <div className="accent-position-strip" style={accentStyle}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <i key={index} className={[index % 4 === 0 ? 'downbeat-position' : 'offbeat-position', index === movingAccentStep ? 'active' : ''].filter(Boolean).join(' ')}>{countLabel(index)}</i>
          ))}
        </div>
      </section>

      <section className="panel training-feature-block routine-builder" aria-label="연습 루틴 빌더">
        <div className="feature-heading">
          <div><strong>연습 루틴 빌더</strong><span>BPM·마디 수·그루브·악센트 이동을 단계별로 저장하고 4/4와 홀수 박자를 자동으로 전환합니다.</span></div>
          <span className="status-chip">총 {routineTotalBars(routineSteps)}마디</span>
        </div>
        <div className="routine-step-list">
          {routineSteps.map((step, index) => (
            <div key={step.id} className={routineRunning && index === routineIndex ? 'routine-step active' : 'routine-step'}>
              <span className="routine-index">{index + 1}</span>
              <label>이름<input value={step.name} onChange={(event) => updateRoutine(index, { name: event.target.value })} /></label>
              <label>BPM<input type="number" min={20} max={400} value={step.bpm} onChange={(event) => updateRoutine(index, { bpm: Number(event.target.value) })} /></label>
              <label>마디<input type="number" min={1} max={128} value={step.bars} onChange={(event) => updateRoutine(index, { bars: Number(event.target.value) })} /></label>
              <label>그루브<select value={step.patternId} onChange={(event) => updateRoutine(index, { patternId: event.target.value })}>{GROOVE_PATTERNS.map((preset) => <option key={preset.id} value={preset.id}>{preset.beatsPerBar}/4 · {preset.name}</option>)}<option value="custom">{pattern.beatsPerBar}/4 · 내 커스텀</option></select></label>
              <label className="routine-accent"><input type="checkbox" checked={step.accentTrainer} onChange={(event) => updateRoutine(index, { accentTrainer: event.target.checked })} />악센트 이동</label>
              <button type="button" className="routine-remove" onClick={() => removeRoutineStep(index)} aria-label={`${step.name} 삭제`}>×</button>
              {routineRunning && index === routineIndex && <div className="routine-current">{Math.min(step.bars, routineBarInStep + 1)} / {step.bars}마디</div>}
            </div>
          ))}
        </div>
        <div className="routine-actions">
          <button type="button" className="secondary-button" disabled={routineRunning} onClick={addRoutineStep}>단계 추가</button>
          <button type="button" className="secondary-button" disabled={routineRunning} onClick={() => onRoutineChange(DEFAULT_ROUTINE.map((step) => ({ ...step })))}>기본 루틴 복원</button>
          {routineRunning ? <button type="button" className="danger-button" onClick={onStopRoutine}>루틴 중지</button> : <button type="button" className="primary-button" onClick={onStartRoutine}>루틴 자동 시작</button>}
        </div>
      </section>
    </section>
  );
}
