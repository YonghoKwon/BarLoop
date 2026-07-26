import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BpmNumberInput from '../components/BpmNumberInput';
import { preparePlaybackAudioSession, releasePlaybackAudioSession } from '../lib/audioPlaybackSession';
import { clampBpm } from '../lib/bpm';
import {
  buildSubdivisionCountGroups,
  getCurrentSubdivisionCount,
  getVisualSubdivision,
  getVisualSubdivisionIndex,
  isSubdivisionSoundCell,
} from '../lib/subdivisionCount';
import {
  isKoreanCountVoiceSupported,
  primeKoreanCountVoice,
  speakKoreanCount,
  stopKoreanCountVoice,
  type CountVoiceMode,
} from '../lib/koreanCountVoice';
import {
  StandaloneMetronomeEngine,
  type MetronomeSound,
  type MetronomeSubdivision,
  type StandaloneMetronomeSettings,
} from '../lib/standaloneMetronome';

const STORAGE_KEY = 'barloop:metronome-lab:v1';

const PRACTICE_PRESETS = [
  {
    name: '8분 기본기',
    description: '느린 템포에서 클릭 사이를 안정적으로 채우며 손과 발의 기본 타이밍을 정리합니다.',
    bpm: 80,
    beatsPerBar: 4,
    subdivision: 2 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 100,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['80 BPM', '8분음표', '10분'],
  },
  {
    name: '16분 균등',
    description: '1 e & a 네 칸의 간격을 같은 크기로 유지하는 데 집중하는 기본 루틴입니다.',
    bpm: 70,
    beatsPerBar: 4,
    subdivision: 4 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 100,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['70 BPM', '16분음표', '균등 연주'],
  },
  {
    name: '백비트 안정',
    description: '2박과 4박을 강조해 스네어 백비트와 그루브 중심을 흔들리지 않게 연습합니다.',
    bpm: 90,
    beatsPerBar: 4,
    subdivision: 2 as MetronomeSubdivision,
    accents: [false, true, false, true],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 110,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['90 BPM', '2·4박 강세', '그루브'],
  },
  {
    name: '내부 박자 점검',
    description: '2마디 클릭 뒤 2마디가 무음이 되어, 클릭 없이도 템포를 유지하는지 확인합니다.',
    bpm: 100,
    beatsPerBar: 4,
    subdivision: 1 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: true,
    gapPlayBars: 2,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 120,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['100 BPM', '2마디 소리', '2마디 무음'],
  },
  {
    name: '16분 속도 올리기',
    description: '80 BPM에서 시작해 8마디마다 5 BPM씩 올리며 120 BPM까지 자연스럽게 확장합니다.',
    bpm: 80,
    beatsPerBar: 4,
    subdivision: 4 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: true,
    trainerTarget: 120,
    trainerStep: 5,
    trainerBars: 8,
    timerMinutes: 15,
    tags: ['80→120 BPM', '+5 BPM', '8마디마다'],
  },
] as const;

interface StoredLabSettings {
  bpm: number;
  beatsPerBar: number;
  subdivision: MetronomeSubdivision;
  volume: number;
  accentVolume: number;
  subdivisionVolume: number;
  swing: number;
  sound: MetronomeSound;
  countMode: CountVoiceMode;
  accents: boolean[];
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
  trainerEnabled: boolean;
  trainerTarget: number;
  trainerStep: number;
  trainerBars: number;
  timerMinutes: number;
  practicePresetIndex: number;
}

const DEFAULTS: StoredLabSettings = {
  bpm: 100,
  beatsPerBar: 4,
  subdivision: 1,
  volume: 0.68,
  accentVolume: 0.9,
  subdivisionVolume: 0.34,
  swing: 0.5,
  sound: 'classic',
  countMode: 'click',
  accents: [true, false, false, false],
  gapEnabled: false,
  gapPlayBars: 4,
  gapMuteBars: 2,
  trainerEnabled: false,
  trainerTarget: 140,
  trainerStep: 5,
  trainerBars: 4,
  timerMinutes: 10,
  practicePresetIndex: 1,
};

function readSettings(): StoredLabSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<StoredLabSettings>;
    const beatsPerBar = Math.min(12, Math.max(2, Math.round(Number(stored.beatsPerBar) || 4)));
    const countMode = ['click', 'voice', 'both'].includes(String(stored.countMode))
      ? (stored.countMode as CountVoiceMode)
      : DEFAULTS.countMode;
    return {
      ...DEFAULTS,
      ...stored,
      countMode,
      practicePresetIndex: Math.min(
        PRACTICE_PRESETS.length - 1,
        Math.max(
          0,
          Math.round(Number(stored.practicePresetIndex ?? (stored as { rudimentIndex?: number }).rudimentIndex ?? DEFAULTS.practicePresetIndex)),
        ),
      ),
      bpm: clampBpm(Number(stored.bpm) || DEFAULTS.bpm),
      beatsPerBar,
      subdivision: [1, 2, 3, 4].includes(Number(stored.subdivision))
        ? (Number(stored.subdivision) as MetronomeSubdivision)
        : 1,
      accents: Array.from({ length: beatsPerBar }, (_, index) => stored.accents?.[index] ?? index === 0),
    };
  } catch {
    return DEFAULTS;
  }
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

export default function MetronomeLabPage() {
  const initial = useRef(readSettings()).current;
  const engineRef = useRef(new StandaloneMetronomeEngine());
  const tapTimesRef = useRef<number[]>([]);
  const barCountRef = useRef(0);

  const [bpm, setBpm] = useState(initial.bpm);
  const [beatsPerBar, setBeatsPerBar] = useState(initial.beatsPerBar);
  const [subdivision, setSubdivision] = useState<MetronomeSubdivision>(initial.subdivision);
  const [volume, setVolume] = useState(initial.volume);
  const [accentVolume, setAccentVolume] = useState(initial.accentVolume);
  const [subdivisionVolume, setSubdivisionVolume] = useState(initial.subdivisionVolume);
  const [swing, setSwing] = useState(initial.swing);
  const [sound, setSound] = useState<MetronomeSound>(initial.sound);
  const [countMode, setCountMode] = useState<CountVoiceMode>(initial.countMode);
  const [accents, setAccents] = useState(initial.accents);
  const [gapEnabled, setGapEnabled] = useState(initial.gapEnabled);
  const [gapPlayBars, setGapPlayBars] = useState(initial.gapPlayBars);
  const [gapMuteBars, setGapMuteBars] = useState(initial.gapMuteBars);
  const [trainerEnabled, setTrainerEnabled] = useState(initial.trainerEnabled);
  const [trainerTarget, setTrainerTarget] = useState(initial.trainerTarget);
  const [trainerStep, setTrainerStep] = useState(initial.trainerStep);
  const [trainerBars, setTrainerBars] = useState(initial.trainerBars);
  const [timerMinutes, setTimerMinutes] = useState(initial.timerMinutes);
  const [practicePresetIndex, setPracticePresetIndex] = useState(initial.practicePresetIndex);
  const [running, setRunning] = useState(false);
  const [beatInBar, setBeatInBar] = useState(0);
  const [subdivisionInBeat, setSubdivisionInBeat] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audible, setAudible] = useState(true);
  const [notice, setNotice] = useState('');

  const voiceSupported = isKoreanCountVoiceSupported();
  const voiceConfigRef = useRef({ countMode, bpm, volume, accentVolume, accents });
  voiceConfigRef.current = { countMode, bpm, volume, accentVolume, accents };

  const settings = useMemo<StandaloneMetronomeSettings>(
    () => ({
      bpm,
      beatsPerBar,
      subdivision,
      volume,
      accentVolume,
      subdivisionVolume,
      swing,
      sound,
      accents,
      gapEnabled,
      gapPlayBars,
      gapMuteBars,
    }),
    [
      accentVolume,
      accents,
      beatsPerBar,
      bpm,
      gapEnabled,
      gapMuteBars,
      gapPlayBars,
      sound,
      subdivision,
      subdivisionVolume,
      swing,
      volume,
    ],
  );

  const engineSettings = useMemo<StandaloneMetronomeSettings>(() => {
    if (countMode !== 'voice' || !voiceSupported) return settings;
    return {
      ...settings,
      volume: 0,
      accentVolume: 0,
      subdivisionVolume: 0,
    };
  }, [countMode, settings, voiceSupported]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    stopKoreanCountVoice();
    releasePlaybackAudioSession();
    setRunning(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...settings,
        countMode,
        trainerEnabled,
        trainerTarget,
        trainerStep,
        trainerBars,
        timerMinutes,
        practicePresetIndex,
      }),
    );
  }, [countMode, practicePresetIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);

  useEffect(() => {
    engineRef.current.update(engineSettings);
  }, [engineSettings]);

  useEffect(() => {
    setAccents((current) =>
      Array.from({ length: beatsPerBar }, (_, index) => current[index] ?? index === 0),
    );
    setBeatInBar(0);
  }, [beatsPerBar]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => {
        const next = seconds + 1;
        if (timerMinutes > 0 && next >= timerMinutes * 60) {
          stop();
          setNotice(`${timerMinutes}분 연습 목표를 완료했습니다.`);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, stop, timerMinutes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        document.getElementById('metronome-toggle')?.click();
      }
      if (event.key === '+' || event.key === '=') setBpm((value) => clampBpm(value + 1));
      if (event.key === '-') setBpm((value) => clampBpm(value - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(
    () => () => {
      engineRef.current.stop();
      stopKoreanCountVoice();
      releasePlaybackAudioSession();
    },
    [],
  );

  const start = useCallback(async () => {
    setNotice('');
    barCountRef.current = 0;
    setBarCount(0);
    setElapsedSeconds(0);
    primeKoreanCountVoice();

    if (countMode !== 'click' && !voiceSupported) {
      setNotice('이 브라우저는 한국어 음성 합성을 지원하지 않아 클릭음으로 재생합니다.');
    }

    try {
      const playbackSession = preparePlaybackAudioSession();
      const metronome = engineRef.current.start(engineSettings, (tick) => {
        setBeatInBar(tick.beatInBar);
        setSubdivisionInBeat(tick.subdivisionInBeat);
        setAudible(tick.audible);

        const voice = voiceConfigRef.current;
        if (
          tick.audible &&
          tick.subdivisionInBeat === 0 &&
          voice.countMode !== 'click' &&
          isKoreanCountVoiceSupported()
        ) {
          const voiceVolume = voice.accents[tick.beatInBar] ? voice.accentVolume : voice.volume;
          speakKoreanCount(tick.beatInBar, voice.bpm, voiceVolume);
        }

        if (tick.beatInBar === 0 && tick.subdivisionInBeat === 0) {
          const nextBars = barCountRef.current + 1;
          barCountRef.current = nextBars;
          setBarCount(nextBars);
          if (trainerEnabled && nextBars % Math.max(1, trainerBars) === 0) {
            setBpm((current) => Math.min(clampBpm(trainerTarget), current + Math.max(1, trainerStep)));
          }
        }
      });

      await Promise.all([playbackSession, metronome]);
      setRunning(true);
    } catch (error) {
      releasePlaybackAudioSession();
      setNotice(error instanceof Error ? error.message : '메트로놈을 시작할 수 없습니다.');
    }
  }, [countMode, engineSettings, trainerBars, trainerEnabled, trainerStep, trainerTarget, voiceSupported]);

  const testVoice = useCallback(async () => {
    setNotice('');
    const playbackSession = preparePlaybackAudioSession();
    primeKoreanCountVoice();
    const spoken = speakKoreanCount(0, bpm, accentVolume);
    await playbackSession;
    setNotice(spoken ? '한국어 카운트 음성을 재생했습니다.' : '이 브라우저는 한국어 음성 합성을 지원하지 않습니다.');
  }, [accentVolume, bpm]);

  const tapTempo = () => {
    const now = performance.now();
    const recent = tapTimesRef.current.filter((time) => now - time < 2500);
    recent.push(now);
    tapTimesRef.current = recent.slice(-8);
    if (tapTimesRef.current.length < 2) return;
    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    setBpm(clampBpm(60000 / average));
  };

  const practicePreset = PRACTICE_PRESETS[Math.min(PRACTICE_PRESETS.length - 1, Math.max(0, practicePresetIndex))];

  const applyPracticePreset = () => {
    if (running) stop();
    setBpm(practicePreset.bpm);
    setBeatsPerBar(practicePreset.beatsPerBar);
    setSubdivision(practicePreset.subdivision);
    setSwing(0.5);
    setAccents([...practicePreset.accents]);
    setGapEnabled(practicePreset.gapEnabled);
    setGapPlayBars(practicePreset.gapPlayBars);
    setGapMuteBars(practicePreset.gapMuteBars);
    setTrainerEnabled(practicePreset.trainerEnabled);
    setTrainerTarget(practicePreset.trainerTarget);
    setTrainerStep(practicePreset.trainerStep);
    setTrainerBars(practicePreset.trainerBars);
    setTimerMinutes(practicePreset.timerMinutes);
    barCountRef.current = 0;
    setBarCount(0);
    setElapsedSeconds(0);
    setNotice(`${practicePreset.name} 프리셋을 적용했습니다. 시작 버튼을 눌러 연습하세요.`);
  };

  const progress = timerMinutes > 0 ? Math.min(100, (elapsedSeconds / (timerMinutes * 60)) * 100) : 0;
  const visualSubdivision = getVisualSubdivision(subdivision);
  const subdivisionCountGroups = useMemo(
    () => buildSubdivisionCountGroups(beatsPerBar, visualSubdivision),
    [beatsPerBar, visualSubdivision],
  );
  const currentSubdivisionCount = getCurrentSubdivisionCount(
    beatInBar,
    subdivisionInBeat,
    subdivision,
  );
  const activeVisualSubdivisionIndex = getVisualSubdivisionIndex(
    subdivision,
    subdivisionInBeat,
  );

  return (
    <div className="metronome-lab-page">
      <header className="lab-header">
        <button type="button" className="secondary-button" onClick={() => { window.location.hash = ''; }}>
          ← 영상 연습으로
        </button>
        <div>
          <span className="eyebrow">BARLOOP LAB</span>
          <h1>드러머 메트로놈</h1>
          <p>영상이나 음원 없이 사용하는 독립 연습 페이지</p>
        </div>
        <div className={running ? 'lab-live active' : 'lab-live'}>{running ? 'RUNNING' : 'READY'}</div>
      </header>

      <main className="lab-layout">
        <section className="lab-stage panel">
          <div className={audible ? 'beat-orbit' : 'beat-orbit muted'}>
            <div className="beat-number current-count-position">{currentSubdivisionCount}</div>
            <span>{audible ? (countMode === 'voice' ? 'VOICE' : countMode === 'both' ? 'BOTH' : 'CLICK') : 'GAP'}</span>
          </div>

          <div className="lab-bpm-row">
            <button type="button" onClick={() => setBpm((value) => clampBpm(value - 1))}>−</button>
            <div className="lab-bpm-input">
              <BpmNumberInput value={bpm} onChange={setBpm} ariaLabel="메트로놈 BPM" />
              <strong>BPM</strong>
            </div>
            <button type="button" onClick={() => setBpm((value) => clampBpm(value + 1))}>＋</button>
          </div>

          <div className="beat-dots" aria-label="현재 박자">
            {Array.from({ length: beatsPerBar }, (_, index) => (
              <i key={index} className={index === beatInBar ? 'active' : ''} />
            ))}
          </div>
          <div className="subdivision-meter">
            {Array.from({ length: subdivision }, (_, index) => (
              <i key={index} className={index === subdivisionInBeat ? 'active' : ''} />
            ))}
          </div>

          <div className={beatsPerBar <= 4 ? 'subdivision-count-guide fit-full-bar' : 'subdivision-count-guide'} aria-label="한 마디 서브디비전 카운트">
            {subdivisionCountGroups.map((labels, countBeatIndex) => (
              <div
                key={countBeatIndex}
                className={countBeatIndex === beatInBar ? 'count-beat-group active-beat' : 'count-beat-group'}
              >
                {labels.map((label, countSubdivisionIndex) => (
                  <span
                    key={`${countBeatIndex}-${countSubdivisionIndex}`}
                    className={[
                      isSubdivisionSoundCell(subdivision, countSubdivisionIndex)
                        ? 'sound-on'
                        : 'guide-only',
                      countBeatIndex === beatInBar &&
                      countSubdivisionIndex === activeVisualSubdivisionIndex
                        ? 'active'
                        : '',
                    ].filter(Boolean).join(' ')}
                    title={
                      isSubdivisionSoundCell(subdivision, countSubdivisionIndex)
                        ? '실제 클릭이 나는 위치'
                        : '소리 없이 박을 나누어 보는 안내 위치'
                    }
                  >
                    {label}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="subdivision-count-hint">
            {subdivision === 4
              ? '16분음표 클릭 · 모든 1 e & a 칸에서 소리'
              : subdivision === 3
                ? '셋잇단 클릭 · 1 trip let 세 칸으로 표시'
                : subdivision === 2
                  ? '8분음표 클릭 · 16분 격자에서 숫자와 & 칸에 소리'
                  : '4분음표 클릭 · 16분 격자는 보이지만 숫자 칸에서만 소리'}
          </p>

          <div className="lab-primary-actions">
            <button id="metronome-toggle" type="button" className="primary-button" onClick={running ? stop : start}>
              {running ? '정지' : '시작'}
            </button>
            <button type="button" className="secondary-button" onClick={tapTempo}>TAP TEMPO</button>
          </div>

          <div className="quick-bpm-row">
            {[60, 80, 100, 120, 140, 160, 180].map((value) => (
              <button key={value} type="button" className={bpm === value ? 'active' : ''} onClick={() => setBpm(value)}>
                {value}
              </button>
            ))}
          </div>

          <div className="lab-session-strip">
            <span>시간 <strong>{formatClock(elapsedSeconds)}</strong></span>
            <span>마디 <strong>{barCount}</strong></span>
            <span>목표 <strong>{timerMinutes ? `${timerMinutes}분` : '없음'}</strong></span>
          </div>
          <div className="lab-progress"><i style={{ width: `${progress}%` }} /></div>
          {notice && <p className="lab-notice">{notice}</p>}
        </section>

        <div className="lab-controls">
          <section className="panel lab-panel">
            <div className="section-title-row"><h2>박자와 악센트</h2><span>{beatsPerBar}/4</span></div>
            <div className="compact-grid three">
              <label>박자 수
                <select value={beatsPerBar} onChange={(event) => setBeatsPerBar(Number(event.target.value))}>
                  {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>서브디비전
                <select value={subdivision} onChange={(event) => setSubdivision(Number(event.target.value) as MetronomeSubdivision)}>
                  <option value={1}>4분음표</option><option value={2}>8분음표</option><option value={3}>셋잇단</option><option value={4}>16분음표</option>
                </select>
              </label>
              <label>스윙
                <select value={swing} disabled={subdivision === 1 || subdivision === 3} onChange={(event) => setSwing(Number(event.target.value))}>
                  <option value={0.5}>Straight</option><option value={0.58}>Light</option><option value={0.66}>Triplet</option><option value={0.72}>Heavy</option>
                </select>
              </label>
            </div>
            <div className="accent-sequencer">
              {accents.map((active, index) => (
                <button key={index} type="button" className={active ? 'active' : ''} onClick={() => setAccents((current) => current.map((value, item) => item === index ? !value : value))}>
                  <strong>{index + 1}</strong><span>{active ? '강세' : '보통'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel lab-panel">
            <div className="section-title-row"><h2>오디오 믹서</h2><span>{countMode === 'click' ? sound : countMode === 'voice' ? '한국어 음성' : `${sound} + 음성`}</span></div>
            <div className="compact-grid two">
              <label>메인 박 출력
                <select value={countMode} onChange={(event) => setCountMode(event.target.value as CountVoiceMode)}>
                  <option value="click">클릭음</option>
                  <option value="voice">한국어 카운트</option>
                  <option value="both">클릭 + 한국어 카운트</option>
                </select>
              </label>
              <label>클릭 음색
                <select value={sound} disabled={countMode === 'voice'} onChange={(event) => setSound(event.target.value as MetronomeSound)}>
                  <option value="classic">Classic</option><option value="wood">Wood</option><option value="rim">Rim</option><option value="cowbell">Cowbell</option>
                </select>
              </label>
              <label>기본 클릭 {Math.round(volume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={volume} disabled={countMode === 'voice'} onChange={(event) => setVolume(Number(event.target.value))} />
              </label>
              <label>강세·음성 {Math.round(accentVolume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={accentVolume} onChange={(event) => setAccentVolume(Number(event.target.value))} />
              </label>
              <label>서브디비전 {Math.round(subdivisionVolume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={subdivisionVolume} disabled={countMode === 'voice'} onChange={(event) => setSubdivisionVolume(Number(event.target.value))} />
              </label>
            </div>
            <button type="button" className="secondary-button full-width" onClick={() => void testVoice()}>
              한국어 음성 테스트 · 하나
            </button>
            <p className="hint">
              한국어 카운트는 메인 박마다 하나·둘·셋·넷으로 읽습니다. 빠른 BPM에서는 시스템 음성 특성상 클릭보다 조금 늦을 수 있습니다.
            </p>
          </section>

          <section className="panel lab-panel">
            <div className="section-title-row"><h2>Gap Click</h2><label className="switch-label"><input type="checkbox" checked={gapEnabled} onChange={(event) => setGapEnabled(event.target.checked)} /><span>사용</span></label></div>
            <div className="compact-grid two">
              <label>클릭 마디<input type="number" min={1} max={32} value={gapPlayBars} onChange={(event) => setGapPlayBars(Math.max(1, Number(event.target.value)))} /></label>
              <label>무음 마디<input type="number" min={1} max={32} value={gapMuteBars} onChange={(event) => setGapMuteBars(Math.max(1, Number(event.target.value)))} /></label>
            </div>
          </section>

          <section className="panel lab-panel">
            <div className="section-title-row"><h2>템포 트레이너</h2><label className="switch-label"><input type="checkbox" checked={trainerEnabled} onChange={(event) => setTrainerEnabled(event.target.checked)} /><span>자동 증가</span></label></div>
            <div className="compact-grid three">
              <label>목표 BPM<BpmNumberInput value={trainerTarget} onChange={setTrainerTarget} ariaLabel="메트로놈 목표 BPM" /></label>
              <label>증가 폭<input type="number" min={1} max={30} value={trainerStep} onChange={(event) => setTrainerStep(Math.max(1, Number(event.target.value)))} /></label>
              <label>증가 주기<input type="number" min={1} max={64} value={trainerBars} onChange={(event) => setTrainerBars(Math.max(1, Number(event.target.value)))} /><span className="field-suffix">마디</span></label>
            </div>
          </section>

          <section className="panel lab-panel practice-preset-panel">
            <div className="section-title-row">
              <div>
                <h2>연습 프리셋</h2>
                <span className="subtle">목적에 맞는 메트로놈 설정을 한 번에 적용합니다.</span>
              </div>
              <select
                aria-label="연습 프리셋 선택"
                value={practicePresetIndex}
                onChange={(event) => setPracticePresetIndex(Number(event.target.value))}
              >
                {PRACTICE_PRESETS.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}
              </select>
            </div>
            <div className="practice-preset-summary">
              <strong>{practicePreset.name}</strong>
              <p>{practicePreset.description}</p>
              <div className="practice-preset-tags">
                {practicePreset.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
            <button type="button" className="primary-button" onClick={applyPracticePreset}>
              이 설정으로 연습 준비
            </button>
            <p className="hint">클릭 음색과 음량은 현재 값을 유지하며, BPM·박자·서브디비전·악센트·Gap Click·템포 트레이너·타이머만 변경합니다.</p>
          </section>

          <section className="panel lab-panel">
            <div className="section-title-row"><h2>연습 타이머</h2><span>{timerMinutes ? `${timerMinutes}분` : '무제한'}</span></div>
            <div className="quick-bpm-row">
              {[0, 5, 10, 15, 20, 30].map((value) => <button key={value} type="button" className={timerMinutes === value ? 'active' : ''} onClick={() => setTimerMinutes(value)}>{value === 0 ? '∞' : `${value}분`}</button>)}
            </div>
          </section>
        </div>
      </main>

      <footer className="lab-footer">iPhone 무음 모드 대응 재생 세션 · Space 시작/정지 · +/− BPM 조절 · 설정 자동 저장</footer>
    </div>
  );
}
