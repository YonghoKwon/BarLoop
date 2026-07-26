import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BpmNumberInput from '../components/BpmNumberInput';
import DrummerTrainingSuite from '../components/DrummerTrainingSuite';
import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';
import { clampBpm } from '../lib/bpm';
import {
  DEFAULT_CUSTOM_PATTERN,
  DEFAULT_ROUTINE,
  DRUM_INSTRUMENT_IDS,
  grooveById,
  nextMovingAccentIndex,
  normalizePattern,
  type DrumPattern,
  type PracticeRoutineStep,
} from '../lib/drummerPractice';
import { StandaloneMetronomeEngine, type StandaloneMetronomeSettings } from '../lib/standaloneMetronome';

const STORAGE_KEY = 'barloop:drummer-training:v1';
const SWING_OPTIONS = [
  { value: 0.5, label: 'Straight · 50%' },
  { value: 0.54, label: '아주 약한 스윙 · 54%' },
  { value: 0.58, label: '가벼운 스윙 · 58%' },
  { value: 0.62, label: '셔플 라이트 · 62%' },
  { value: 0.66, label: '트리플렛 스윙 · 66%' },
  { value: 0.7, label: '깊은 스윙 · 70%' },
  { value: 0.75, label: '하드 스윙 · 75%' },
];

interface StoredTrainingSettings {
  bpm: number;
  volume: number;
  pattern: DrumPattern;
  rhythmEnabled: boolean;
  accentTrainerEnabled: boolean;
  accentEveryBars: number;
  accentMode: 'forward' | 'random';
  movingAccentStep: number;
  routineSteps: PracticeRoutineStep[];
  accentFlashEnabled: boolean;
}

const DEFAULTS: StoredTrainingSettings = {
  bpm: 90,
  volume: 0.72,
  pattern: DEFAULT_CUSTOM_PATTERN,
  rhythmEnabled: true,
  accentTrainerEnabled: false,
  accentEveryBars: 1,
  accentMode: 'forward',
  movingAccentStep: 0,
  routineSteps: DEFAULT_ROUTINE,
  accentFlashEnabled: true,
};

function normalizeRoutine(value: unknown): PracticeRoutineStep[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_ROUTINE.map((step) => ({ ...step }));
  return value.slice(0, 16).map((raw, index) => {
    const item = raw as Partial<PracticeRoutineStep>;
    return {
      id: typeof item.id === 'string' ? item.id : `step-${index + 1}`,
      name: typeof item.name === 'string' && item.name.trim() ? item.name : `단계 ${index + 1}`,
      bpm: clampBpm(Number(item.bpm) || 90),
      bars: Math.min(128, Math.max(1, Math.round(Number(item.bars) || 8))),
      patternId: typeof item.patternId === 'string' ? item.patternId : 'basic-rock',
      accentTrainer: Boolean(item.accentTrainer),
    };
  });
}

function readSettings(): StoredTrainingSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<StoredTrainingSettings>;
    return {
      bpm: clampBpm(Number(stored.bpm) || DEFAULTS.bpm),
      volume: Math.min(1, Math.max(0.05, Number(stored.volume) || DEFAULTS.volume)),
      pattern: normalizePattern(stored.pattern),
      rhythmEnabled: stored.rhythmEnabled !== false,
      accentTrainerEnabled: Boolean(stored.accentTrainerEnabled),
      accentEveryBars: [1, 2, 4, 8].includes(Number(stored.accentEveryBars)) ? Number(stored.accentEveryBars) : 1,
      accentMode: stored.accentMode === 'random' ? 'random' : 'forward',
      movingAccentStep: Math.min(15, Math.max(0, Math.round(Number(stored.movingAccentStep) || 0))),
      routineSteps: normalizeRoutine(stored.routineSteps),
      accentFlashEnabled: stored.accentFlashEnabled !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

function countLabel(step: number): string {
  const beat = Math.floor(step / 4) + 1;
  return [String(beat), 'e', '&', 'a'][step % 4];
}

export default function DrummerTrainingPage() {
  const initial = useRef(readSettings()).current;
  const engineRef = useRef(new StandaloneMetronomeEngine());
  const barCountRef = useRef(0);
  const routineRunningRef = useRef(false);
  const routineIndexRef = useRef(0);
  const routineBarRef = useRef(0);
  const pendingRoutineStartRef = useRef(false);

  const [bpm, setBpm] = useState(initial.bpm);
  const [volume, setVolume] = useState(initial.volume);
  const [pattern, setPattern] = useState<DrumPattern>(normalizePattern(initial.pattern));
  const [rhythmEnabled, setRhythmEnabled] = useState(initial.rhythmEnabled);
  const [accentTrainerEnabled, setAccentTrainerEnabled] = useState(initial.accentTrainerEnabled);
  const [accentEveryBars, setAccentEveryBars] = useState(initial.accentEveryBars);
  const [accentMode, setAccentMode] = useState<'forward' | 'random'>(initial.accentMode);
  const [movingAccentStep, setMovingAccentStep] = useState(initial.movingAccentStep);
  const [routineSteps, setRoutineSteps] = useState<PracticeRoutineStep[]>(normalizeRoutine(initial.routineSteps));
  const [routineRunning, setRoutineRunning] = useState(false);
  const [routineIndex, setRoutineIndex] = useState(0);
  const [routineBarInStep, setRoutineBarInStep] = useState(0);
  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [beatInBar, setBeatInBar] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [flashPulse, setFlashPulse] = useState(0);
  const [notice, setNotice] = useState('');

  routineRunningRef.current = routineRunning;
  routineIndexRef.current = routineIndex;
  const routineStepsRef = useRef(routineSteps);
  routineStepsRef.current = routineSteps;
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const accentRef = useRef({ enabled: accentTrainerEnabled, everyBars: accentEveryBars, mode: accentMode });
  accentRef.current = { enabled: accentTrainerEnabled, everyBars: accentEveryBars, mode: accentMode };

  const settings = useMemo<StandaloneMetronomeSettings>(() => ({
    bpm,
    beatsPerBar: 4,
    subdivision: 4,
    volume,
    accentVolume: Math.min(1, volume + 0.2),
    subdivisionVolume: volume,
    swing: pattern.swing,
    sound: 'classic',
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 0,
    rhythmEnabled,
    rhythmPattern: pattern,
    rhythmVolume: volume,
    movingAccentStep: accentTrainerEnabled ? movingAccentStep : null,
  }), [accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, volume]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    releasePlaybackAudioSession();
    setRunning(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bpm,
      volume,
      pattern,
      rhythmEnabled,
      accentTrainerEnabled,
      accentEveryBars,
      accentMode,
      movingAccentStep,
      routineSteps,
      accentFlashEnabled,
    }));
  }, [accentEveryBars, accentFlashEnabled, accentMode, accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, routineSteps, volume]);

  useEffect(() => {
    engineRef.current.update(settings);
  }, [settings]);

  useEffect(() => () => {
    engineRef.current.stop();
    releasePlaybackAudioSession();
  }, []);

  const applyRoutineStep = useCallback((step: PracticeRoutineStep) => {
    const nextPattern = grooveById(step.patternId, patternRef.current);
    setBpm(clampBpm(step.bpm));
    setPattern(nextPattern);
    setRhythmEnabled(true);
    setAccentTrainerEnabled(step.accentTrainer);
    setMovingAccentStep(0);
  }, []);

  const start = useCallback(async () => {
    setNotice('');
    barCountRef.current = 0;
    setBarCount(0);
    try {
      await Promise.all([
        preparePlaybackAudioSession(),
        engineRef.current.start(settings, (tick) => {
          setActiveStep(tick.stepInBar);
          setBeatInBar(tick.beatInBar);

          const activePattern = patternRef.current;
          const patternAccent = DRUM_INSTRUMENT_IDS.some(
            (instrument) => activePattern.steps[instrument][tick.stepInBar] === 2,
          );
          const movingAccent = accentRef.current.enabled && tick.stepInBar === movingAccentStep;
          if (accentFlashEnabled && (patternAccent || movingAccent)) setFlashPulse((value) => value + 1);

          if (tick.beatInBar !== 0 || tick.subdivisionInBeat !== 0) return;
          const nextBars = barCountRef.current + 1;
          barCountRef.current = nextBars;
          setBarCount(nextBars);

          const accentConfig = accentRef.current;
          if (accentConfig.enabled && nextBars % Math.max(1, accentConfig.everyBars) === 0) {
            setMovingAccentStep((current) => nextMovingAccentIndex(current, accentConfig.mode));
          }

          if (!routineRunningRef.current) return;
          const steps = routineStepsRef.current;
          const currentIndex = routineIndexRef.current;
          const currentStep = steps[currentIndex];
          const completedInStep = routineBarRef.current + 1;
          if (currentStep && completedInStep >= currentStep.bars) {
            const nextIndex = currentIndex + 1;
            if (nextIndex < steps.length) {
              routineBarRef.current = 0;
              routineIndexRef.current = nextIndex;
              setRoutineIndex(nextIndex);
              setRoutineBarInStep(0);
              applyRoutineStep(steps[nextIndex]);
              setNotice(`루틴 ${nextIndex + 1}단계 · ${steps[nextIndex].name}`);
            } else {
              routineRunningRef.current = false;
              setRoutineRunning(false);
              setNotice('연습 루틴을 모두 완료했습니다.');
              window.setTimeout(() => stop(), 0);
            }
          } else {
            routineBarRef.current = completedInStep;
            setRoutineBarInStep(completedInStep);
          }
        }),
      ]);
      setRunning(true);
    } catch (error) {
      releasePlaybackAudioSession();
      setNotice(error instanceof Error ? error.message : '드럼 트레이닝을 시작할 수 없습니다.');
    }
  }, [accentFlashEnabled, applyRoutineStep, movingAccentStep, settings, stop]);

  useEffect(() => {
    if (!pendingRoutineStartRef.current || running) return;
    pendingRoutineStartRef.current = false;
    const timer = window.setTimeout(() => void start(), 50);
    return () => window.clearTimeout(timer);
  }, [running, settings, start]);

  const applyGroove = (nextPattern: DrumPattern) => {
    const normalized = normalizePattern(nextPattern);
    setPattern(normalized);
    setRhythmEnabled(true);
    setNotice(`${normalized.name} 패턴을 적용했습니다.`);
  };

  const startRoutine = () => {
    if (running) stop();
    const steps = normalizeRoutine(routineSteps);
    setRoutineSteps(steps);
    routineStepsRef.current = steps;
    routineIndexRef.current = 0;
    routineBarRef.current = 0;
    routineRunningRef.current = true;
    setRoutineIndex(0);
    setRoutineBarInStep(0);
    setRoutineRunning(true);
    applyRoutineStep(steps[0]);
    pendingRoutineStartRef.current = true;
    setNotice(`루틴 1단계 · ${steps[0].name}`);
  };

  const stopRoutine = () => {
    routineRunningRef.current = false;
    setRoutineRunning(false);
    routineBarRef.current = 0;
    setRoutineBarInStep(0);
    if (running) stop();
    setNotice('연습 루틴을 중지했습니다.');
  };

  return (
    <div className="drummer-training-page">
      <header className="training-page-header">
        <div className="training-page-nav">
          <button type="button" className="secondary-button" onClick={() => { window.location.hash = ''; }}>← 영상 연습</button>
          <button type="button" className="secondary-button" onClick={() => { window.location.hash = 'metronome'; }}>메트로놈</button>
        </div>
        <div>
          <span className="eyebrow">BARLOOP DRUM LAB</span>
          <h1>드럼 트레이닝</h1>
          <p>커스텀 시퀀서·그루브·루틴·악센트 이동을 위한 별도 연습 페이지</p>
        </div>
        <div className={running ? 'lab-live active' : 'lab-live'}>{running ? 'RUNNING' : 'READY'}</div>
      </header>

      <main className="training-page-layout">
        <section className="panel training-stage">
          <div className="training-orbit">
            {accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} className="accent-flash-wave" />}
            <strong>{countLabel(activeStep)}</strong>
            <span>{pattern.name}</span>
          </div>

          <div className="training-bpm-row">
            <button type="button" onClick={() => setBpm((value) => clampBpm(value - 1))}>−</button>
            <div><BpmNumberInput value={bpm} onChange={setBpm} ariaLabel="드럼 트레이닝 BPM" /><span>BPM</span></div>
            <button type="button" onClick={() => setBpm((value) => clampBpm(value + 1))}>＋</button>
          </div>

          <div className="training-measure-guide" aria-label="한 마디 16분음표 위치">
            {Array.from({ length: 4 }, (_, beatIndex) => (
              <div key={beatIndex} className={beatInBar === beatIndex ? 'active-beat' : ''}>
                {[String(beatIndex + 1), 'e', '&', 'a'].map((label, subIndex) => {
                  const step = beatIndex * 4 + subIndex;
                  return <span key={label} className={step === activeStep ? 'active' : ''}>{label}</span>;
                })}
              </div>
            ))}
          </div>

          <div className="training-primary-actions">
            <button id="drummer-training-toggle" type="button" className="primary-button" onClick={running ? stop : start}>{running ? '정지' : '시작'}</button>
            <span>현재 {barCount}마디</span>
          </div>
          {notice && <p className="lab-notice">{notice}</p>}
        </section>

        <section className="panel training-quick-settings">
          <div className="section-title-row"><h2>빠른 설정</h2><span>4/4 · 16분음표</span></div>
          <div className="compact-grid three">
            <label>그루브 음량 {Math.round(volume * 100)}%
              <input type="range" min={0.05} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            </label>
            <label>스윙 강도
              <select value={pattern.swing} onChange={(event) => setPattern((current) => ({ ...current, id: 'custom', name: '내 커스텀 패턴', swing: Number(event.target.value) }))}>
                {SWING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="flash-toggle-card">
              <span>강세 화면 플래시</span>
              <input type="checkbox" checked={accentFlashEnabled} onChange={(event) => setAccentFlashEnabled(event.target.checked)} />
            </label>
          </div>
        </section>

        <DrummerTrainingSuite
          pattern={pattern}
          rhythmEnabled={rhythmEnabled}
          activeStep={activeStep}
          onPatternChange={setPattern}
          onApplyGroove={applyGroove}
          onRhythmEnabledChange={setRhythmEnabled}
          accentTrainerEnabled={accentTrainerEnabled}
          accentEveryBars={accentEveryBars}
          accentMode={accentMode}
          movingAccentStep={movingAccentStep}
          onAccentTrainerChange={setAccentTrainerEnabled}
          onAccentEveryBarsChange={setAccentEveryBars}
          onAccentModeChange={setAccentMode}
          routineSteps={routineSteps}
          routineRunning={routineRunning}
          routineIndex={routineIndex}
          routineBarInStep={routineBarInStep}
          onRoutineChange={setRoutineSteps}
          onStartRoutine={startRoutine}
          onStopRoutine={stopRoutine}
        />
      </main>
    </div>
  );
}
