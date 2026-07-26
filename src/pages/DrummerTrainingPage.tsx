import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import AccentFlashControls from '../components/AccentFlashControls';
import BpmNumberInput from '../components/BpmNumberInput';
import SubdivisionCountGuide from '../components/SubdivisionCountGuide';
import DrummerTrainingSuite from '../components/DrummerTrainingSuite';
import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';
import {
  DEFAULT_ACCENT_FLASH_SETTINGS,
  accentFlashClassName,
  accentFlashInlineStyle,
  normalizeAccentFlashSettings,
  type AccentFlashSettings,
} from '../lib/accentFlash';
import { clampBpm } from '../lib/bpm';
import {
  DEFAULT_CUSTOM_PATTERN,
  DEFAULT_ROUTINE,
  DRUM_INSTRUMENT_IDS,
  grooveById,
  nextMovingAccentIndex,
  normalizePattern,
  patternStepCount,
  resizePattern,
  type DrumPattern,
  type PracticeRoutineStep,
} from '../lib/drummerPractice';
import { StandaloneMetronomeEngine, type MetronomeSound, type MetronomeSubdivision, type StandaloneMetronomeSettings } from '../lib/standaloneMetronome';

const STORAGE_KEY = 'barloop:drummer-training:v3';
const TRAINING_SOUNDS: Array<{ value: MetronomeSound; label: string }> = [
  { value: 'classic', label: 'Classic' }, { value: 'wood', label: 'Wood Block' },
  { value: 'rim', label: 'Rim' }, { value: 'cowbell', label: 'Cowbell' },
  { value: 'digital', label: 'Digital' }, { value: 'clave', label: 'Clave' },
  { value: 'shaker', label: 'Shaker' }, { value: 'low', label: 'Low Pulse' },
];
const TRAINING_SOUND_IDS = TRAINING_SOUNDS.map(({ value }) => value);
const LEGACY_STORAGE_KEY = 'barloop:drummer-training:v1';
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
  kitSize: 4 | 5;
  guideClickEnabled: boolean;
  guideSubdivision: MetronomeSubdivision;
  clickVolume: number;
  accentVolume: number;
  subdivisionVolume: number;
  sound: MetronomeSound;
  accentSound: MetronomeSound;
  accentFlash: AccentFlashSettings;
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
  kitSize: 4,
  guideClickEnabled: true,
  guideSubdivision: 2,
  clickVolume: .42,
  accentVolume: .72,
  subdivisionVolume: .24,
  sound: 'classic',
  accentSound: 'wood',
  accentFlash: DEFAULT_ACCENT_FLASH_SETTINGS,
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
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('barloop:drummer-training:v2') || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}';
    const stored = JSON.parse(raw) as Partial<StoredTrainingSettings>;
    const pattern = normalizePattern(stored.pattern);
    const totalSteps = patternStepCount(pattern.beatsPerBar);
    return {
      bpm: clampBpm(Number(stored.bpm) || DEFAULTS.bpm),
      volume: Math.min(1, Math.max(0.05, Number(stored.volume) || DEFAULTS.volume)),
      pattern,
      rhythmEnabled: stored.rhythmEnabled !== false,
      accentTrainerEnabled: Boolean(stored.accentTrainerEnabled),
      accentEveryBars: [1, 2, 4, 8].includes(Number(stored.accentEveryBars)) ? Number(stored.accentEveryBars) : 1,
      accentMode: stored.accentMode === 'random' ? 'random' : 'forward',
      movingAccentStep: Math.min(totalSteps - 1, Math.max(0, Math.round(Number(stored.movingAccentStep) || 0))),
      routineSteps: normalizeRoutine(stored.routineSteps),
      accentFlashEnabled: stored.accentFlashEnabled !== false,
      kitSize: stored.kitSize === 5 ? 5 : 4,
      guideClickEnabled: stored.guideClickEnabled !== false,
      guideSubdivision: [1, 2, 3, 4].includes(Number(stored.guideSubdivision)) ? Number(stored.guideSubdivision) as MetronomeSubdivision : 2,
      clickVolume: Math.min(1, Math.max(.05, Number(stored.clickVolume) || .42)),
      accentVolume: Math.min(1, Math.max(.05, Number(stored.accentVolume) || .72)),
      subdivisionVolume: Math.min(1, Math.max(0, Number(stored.subdivisionVolume) || .24)),
      sound: TRAINING_SOUND_IDS.includes(stored.sound as MetronomeSound) ? stored.sound as MetronomeSound : 'classic',
      accentSound: TRAINING_SOUND_IDS.includes(stored.accentSound as MetronomeSound) ? stored.accentSound as MetronomeSound : 'wood',
      accentFlash: normalizeAccentFlashSettings(stored.accentFlash),
    };
  } catch {
    return DEFAULTS;
  }
}

function countLabel(step: number): string {
  const beat = Math.floor(step / 4) + 1;
  return [String(beat), 'e', '&', 'a'][step % 4];
}

function groupingLabel(beatsPerBar: number): string {
  const groups: Record<number, string> = {
    5: '3+2', 6: '3+3', 7: '4+3', 8: '4+4', 9: '3+3+3', 10: '5+5', 11: '4+4+3', 12: '4+4+4',
  };
  return groups[beatsPerBar] ?? String(beatsPerBar);
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
  const [kitSize, setKitSize] = useState<4 | 5>(initial.kitSize);
  const [guideClickEnabled, setGuideClickEnabled] = useState(initial.guideClickEnabled);
  const [guideSubdivision, setGuideSubdivision] = useState<MetronomeSubdivision>(initial.guideSubdivision);
  const [clickVolume, setClickVolume] = useState(initial.clickVolume);
  const [accentVolume, setAccentVolume] = useState(initial.accentVolume);
  const [subdivisionVolume, setSubdivisionVolume] = useState(initial.subdivisionVolume);
  const [sound, setSound] = useState<MetronomeSound>(initial.sound);
  const [accentSound, setAccentSound] = useState<MetronomeSound>(initial.accentSound);
  const [guideBeatInBar, setGuideBeatInBar] = useState(0);
  const [guideSubdivisionInBeat, setGuideSubdivisionInBeat] = useState(0);
  const [accentFlash, setAccentFlash] = useState<AccentFlashSettings>(normalizeAccentFlashSettings(initial.accentFlash));
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [beatInBar, setBeatInBar] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [flashPulse, setFlashPulse] = useState(0);
  const [notice, setNotice] = useState('');

  const totalSteps = patternStepCount(pattern.beatsPerBar);
  const guideStyle = { '--measure-columns': Math.min(4, pattern.beatsPerBar) } as CSSProperties;

  routineRunningRef.current = routineRunning;
  routineIndexRef.current = routineIndex;
  const routineStepsRef = useRef(routineSteps);
  routineStepsRef.current = routineSteps;
  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const accentRef = useRef({ enabled: accentTrainerEnabled, everyBars: accentEveryBars, mode: accentMode, step: movingAccentStep });
  accentRef.current = { enabled: accentTrainerEnabled, everyBars: accentEveryBars, mode: accentMode, step: movingAccentStep };

  const settings = useMemo<StandaloneMetronomeSettings>(() => ({
    bpm,
    beatsPerBar: pattern.beatsPerBar,
    subdivision: 4,
    volume: clickVolume,
    accentVolume,
    subdivisionVolume,
    swing: pattern.swing,
    sound,
    accentSound,
    accents: Array.from({ length: pattern.beatsPerBar }, (_, index) => index === 0),
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 0,
    clickEnabled: guideClickEnabled,
    clickOverlayEnabled: guideClickEnabled,
    guideSubdivision,
    rhythmEnabled,
    rhythmPattern: pattern,
    rhythmVolume: volume,
    movingAccentStep: accentTrainerEnabled ? movingAccentStep : null,
  }), [accentSound, accentTrainerEnabled, accentVolume, bpm, clickVolume, guideClickEnabled, guideSubdivision, movingAccentStep, pattern, rhythmEnabled, sound, subdivisionVolume, volume]);

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
      accentFlash,
      kitSize,
      guideClickEnabled,
      guideSubdivision,
      clickVolume,
      accentVolume,
      subdivisionVolume,
      sound,
      accentSound,
    }));
  }, [accentEveryBars, accentFlash, accentFlashEnabled, accentSound, accentVolume, clickVolume, guideClickEnabled, guideSubdivision, kitSize, sound, subdivisionVolume, accentMode, accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, routineSteps, volume]);

  useEffect(() => engineRef.current.update(settings), [settings]);

  useEffect(() => {
    const maxStep = patternStepCount(pattern.beatsPerBar) - 1;
    setMovingAccentStep((current) => Math.min(maxStep, current));
    setActiveStep((current) => Math.min(maxStep, current));
    setBeatInBar((current) => Math.min(pattern.beatsPerBar - 1, current));
  }, [pattern.beatsPerBar]);

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
    setActiveStep(0);
    setBeatInBar(0);
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
          const patternAccent = DRUM_INSTRUMENT_IDS.some((instrument) => activePattern.steps[instrument]?.[tick.stepInBar] === 2);
          const accentConfig = accentRef.current;
          const movingAccent = accentConfig.enabled && tick.stepInBar === accentConfig.step;
          if (accentFlashEnabled && (patternAccent || movingAccent)) setFlashPulse((value) => value + 1);

          if (tick.beatInBar !== 0 || tick.subdivisionInBeat !== 0) return;
          const nextBars = barCountRef.current + 1;
          barCountRef.current = nextBars;
          setBarCount(nextBars);

          if (accentConfig.enabled && nextBars % Math.max(1, accentConfig.everyBars) === 0) {
            const stepCount = patternStepCount(patternRef.current.beatsPerBar);
            setMovingAccentStep((current) => nextMovingAccentIndex(current, accentConfig.mode, stepCount));
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
        }, undefined, (beat, subdivisionStep) => {
          setGuideBeatInBar(beat);
          setGuideSubdivisionInBeat(subdivisionStep);
        }),
      ]);
      setRunning(true);
    } catch (error) {
      releasePlaybackAudioSession();
      setNotice(error instanceof Error ? error.message : '드럼 트레이닝을 시작할 수 없습니다.');
    }
  }, [accentFlashEnabled, applyRoutineStep, settings, stop]);

  useEffect(() => {
    if (!pendingRoutineStartRef.current || running) return;
    pendingRoutineStartRef.current = false;
    const timer = window.setTimeout(() => void start(), 50);
    return () => window.clearTimeout(timer);
  }, [running, settings, start]);

  const applyGroove = (nextPattern: DrumPattern) => {
    const normalized = normalizePattern(nextPattern);
    setPattern(normalized);
    setMovingAccentStep(0);
    setActiveStep(0);
    setBeatInBar(0);
    setRhythmEnabled(true);
    setNotice(`${normalized.beatsPerBar}/4 · ${normalized.name} 패턴을 적용했습니다.`);
  };

  const changeBeatsPerBar = (beatsPerBar: number) => {
    const resized = resizePattern(patternRef.current, beatsPerBar);
    setPattern(resized);
    setMovingAccentStep(0);
    setActiveStep(0);
    setBeatInBar(0);
    setNotice(`${resized.beatsPerBar}/4 · ${patternStepCount(resized.beatsPerBar)}칸으로 시퀀서를 변경했습니다.`);
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
          <p>2~12박 커스텀 시퀀서·홀수 박자·엇박·루틴·악센트 이동을 위한 별도 연습 페이지</p>
        </div>
        <div className={running ? 'lab-live active' : 'lab-live'}>{running ? 'RUNNING' : 'READY'}</div>
      </header>

      <main className="training-page-layout">
        <section className="training-stage panel">
          <div className="training-meter-status"><strong>{pattern.beatsPerBar}/4</strong><span>{groupingLabel(pattern.beatsPerBar)} 묶음 · {totalSteps}칸</span></div>

          <div className="training-orbit">
            {accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} data-testid="accent-flash-effect" className={accentFlashClassName('', accentFlash)} style={accentFlashInlineStyle(accentFlash)} />}
            <strong>{countLabel(activeStep)}</strong>
            <span>{pattern.name}</span>
          </div>

          <div className="training-bpm-row">
            <button type="button" onClick={() => setBpm((value) => clampBpm(value - 1))}>−</button>
            <div><BpmNumberInput value={bpm} onChange={setBpm} ariaLabel="드럼 트레이닝 BPM" /><span>BPM</span></div>
            <button type="button" onClick={() => setBpm((value) => clampBpm(value + 1))}>＋</button>
          </div>

          <div className="training-beat-readout">현재 <strong>{beatInBar + 1}</strong> / {pattern.beatsPerBar}박</div>
          <div className="training-measure-guide" style={guideStyle} aria-label={`${pattern.beatsPerBar}박 한 마디 16분음표 위치`}>
            {Array.from({ length: pattern.beatsPerBar }, (_, beatIndex) => (
              <div key={beatIndex} className={beatInBar === beatIndex ? 'active-beat' : ''}>
                <b>{beatIndex + 1}박</b>
                <section>
                  {[String(beatIndex + 1), 'e', '&', 'a'].map((label, subIndex) => {
                    const step = beatIndex * 4 + subIndex;
                    return <span key={`${beatIndex}-${label}`} className={[subIndex === 0 ? 'downbeat' : subIndex === 2 ? 'eighth-offbeat' : 'sixteenth-between', step === activeStep ? 'active' : ''].filter(Boolean).join(' ')}>{label}</span>;
                  })}
                </section>
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
          <div className="section-title-row"><h2>빠른 설정</h2><span>{pattern.beatsPerBar}/4 · 16분음표 · {groupingLabel(pattern.beatsPerBar)}</span></div>
          <div className="compact-grid three training-settings-grid">
            <label>한 마디 박자
              <select value={pattern.beatsPerBar} onChange={(event) => changeBeatsPerBar(Number(event.target.value))}>
                {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <option key={value} value={value}>{value}/4 · {value * 4}칸</option>)}
              </select>
            </label>
            <label>그루브 음량 {Math.round(volume * 100)}%<input type="range" min={0.05} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
            <label>스윙 강도
              <select value={pattern.swing} onChange={(event) => setPattern((current) => ({ ...current, id: 'custom', name: '내 커스텀 패턴', swing: Number(event.target.value) }))}>
                {SWING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="panel training-audio-settings" aria-label="드럼 트레이닝 클릭 가이드 설정">
          <div className="training-audio-header"><div><span className="eyebrow">CLICK GUIDE</span><h2>클릭 가이드·드럼 구성</h2></div><label className="switch-label"><input type="checkbox" checked={guideClickEnabled} onChange={(event) => setGuideClickEnabled(event.target.checked)} /><span>{guideClickEnabled ? 'ON' : 'OFF'}</span></label></div>
          <div className="training-guide-readout"><span>현재 클릭</span><strong>{guideBeatInBar + 1}{guideSubdivision === 1 ? '' : guideSubdivision === 2 ? guideSubdivisionInBeat === 0 ? '' : ' &' : guideSubdivision === 3 ? ['',' trip',' let'][guideSubdivisionInBeat] : ['',' e',' &',' a'][guideSubdivisionInBeat]}</strong><small>{guideSubdivision === 1 ? '4분음표' : guideSubdivision === 2 ? '8분음표' : guideSubdivision === 3 ? '셋잇단' : '16분음표'}</small></div>
          <SubdivisionCountGuide beatsPerBar={pattern.beatsPerBar} subdivision={guideSubdivision} beatInBar={guideBeatInBar} subdivisionInBeat={guideSubdivisionInBeat} audible={guideClickEnabled} compact />
          <div className="compact-grid three training-settings-grid">
            <label>드럼 구성<select value={kitSize} onChange={(event) => setKitSize(Number(event.target.value) === 5 ? 5 : 4)}><option value={4}>4피스 · 스몰+플로어 탐</option><option value={5}>5피스 · 스몰+미들+플로어 탐</option></select></label>
            <label>클릭 서브디비전<select value={guideSubdivision} onChange={(event) => setGuideSubdivision(Number(event.target.value) as MetronomeSubdivision)}><option value={1}>4분음표</option><option value={2}>8분음표</option><option value={3}>셋잇단</option><option value={4}>16분음표</option></select></label>
            <label>기본 클릭 음색<select value={sound} onChange={(event) => setSound(event.target.value as MetronomeSound)}>{TRAINING_SOUNDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>강조 클릭 음색<select value={accentSound} onChange={(event) => setAccentSound(event.target.value as MetronomeSound)}>{TRAINING_SOUNDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>기본 클릭 {Math.round(clickVolume * 100)}%<input type="range" min={.05} max={1} step={.05} value={clickVolume} onChange={(event) => setClickVolume(Number(event.target.value))} /></label>
            <label>강조 클릭 {Math.round(accentVolume * 100)}%<input type="range" min={.05} max={1} step={.05} value={accentVolume} onChange={(event) => setAccentVolume(Number(event.target.value))} /></label>
            <label>세부 박 클릭 {Math.round(subdivisionVolume * 100)}%<input type="range" min={0} max={1} step={.05} value={subdivisionVolume} onChange={(event) => setSubdivisionVolume(Number(event.target.value))} /></label>
          </div>
          <p className="kit-mode-hint">패턴 시퀀서는 계속 16분음표 해상도로 연주하고, 클릭 가이드는 4분·8분·셋잇단·16분 중에서 독립적으로 선택됩니다. 4피스는 스몰 탐과 플로어 탐, 5피스는 미들 탐이 추가됩니다.</p>
        </section>

        <section className="panel training-accent-settings">
          <AccentFlashControls
            enabled={accentFlashEnabled}
            toggleLabel="강세 화면 플래시"
            settings={accentFlash}
            onEnabledChange={setAccentFlashEnabled}
            onSettingsChange={setAccentFlash}
            onPreview={() => { setAccentFlashEnabled(true); setFlashPulse((value) => value + 1); }}
          />
        </section>

        <DrummerTrainingSuite
          pattern={pattern}
          kitSize={kitSize}
          rhythmEnabled={rhythmEnabled}
          activeStep={activeStep}
          onPatternChange={setPattern}
          onApplyGroove={applyGroove}
          onBeatsPerBarChange={changeBeatsPerBar}
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
