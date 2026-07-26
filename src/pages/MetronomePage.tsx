import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

const STORAGE_KEY = 'barloop:metronome:v2';
const SWING_OPTIONS = [
  { value: 0.5, label: 'Straight · 50%' },
  { value: 0.54, label: '아주 약한 스윙 · 54%' },
  { value: 0.58, label: '가벼운 스윙 · 58%' },
  { value: 0.62, label: '셔플 라이트 · 62%' },
  { value: 0.66, label: '트리플렛 스윙 · 66%' },
  { value: 0.7, label: '깊은 스윙 · 70%' },
  { value: 0.75, label: '하드 스윙 · 75%' },
];
const SOUND_OPTIONS: Array<{ value: MetronomeSound; label: string; description: string }> = [
  { value: 'classic', label: 'Classic', description: '선명한 기본 전자 클릭' },
  { value: 'wood', label: 'Wood Block', description: '부드러운 우드 블록' },
  { value: 'rim', label: 'Rim', description: '날카로운 림 클릭' },
  { value: 'cowbell', label: 'Cowbell', description: '중저역 카우벨' },
  { value: 'digital', label: 'Digital', description: '짧고 밝은 디지털 비프' },
  { value: 'clave', label: 'Clave', description: '단단한 클라베 어택' },
  { value: 'shaker', label: 'Shaker', description: '고역의 짧은 셰이커 클릭' },
  { value: 'low', label: 'Low Pulse', description: '낮고 묵직한 펄스' },
];

const PRACTICE_PRESETS = [
  { name: '8분 기본기', bpm: 80, subdivision: 2 as MetronomeSubdivision, accents: [true, false, false, false], gap: false, timer: 10 },
  { name: '16분 균등', bpm: 70, subdivision: 4 as MetronomeSubdivision, accents: [true, false, false, false], gap: false, timer: 10 },
  { name: '백비트 안정', bpm: 90, subdivision: 2 as MetronomeSubdivision, accents: [false, true, false, true], gap: false, timer: 10 },
  { name: '내부 박자 점검', bpm: 100, subdivision: 1 as MetronomeSubdivision, accents: [true, false, false, false], gap: true, timer: 10 },
] as const;

interface StoredSettings {
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
  presetIndex: number;
  accentFlashEnabled: boolean;
}

const DEFAULTS: StoredSettings = {
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
  presetIndex: 1,
  accentFlashEnabled: true,
};

function readSettings(): StoredSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('barloop:metronome-lab:v1') || '{}') as Partial<StoredSettings>;
    const beatsPerBar = Math.min(12, Math.max(2, Math.round(Number(stored.beatsPerBar) || 4)));
    const sound = SOUND_OPTIONS.some((item) => item.value === stored.sound) ? stored.sound as MetronomeSound : 'classic';
    return {
      ...DEFAULTS,
      ...stored,
      bpm: clampBpm(Number(stored.bpm) || DEFAULTS.bpm),
      beatsPerBar,
      subdivision: [1, 2, 3, 4].includes(Number(stored.subdivision)) ? Number(stored.subdivision) as MetronomeSubdivision : 1,
      swing: Math.min(0.75, Math.max(0.5, Number(stored.swing) || 0.5)),
      sound,
      countMode: ['click', 'voice', 'both'].includes(String(stored.countMode)) ? stored.countMode as CountVoiceMode : 'click',
      accents: Array.from({ length: beatsPerBar }, (_, index) => stored.accents?.[index] ?? index === 0),
      presetIndex: Math.min(PRACTICE_PRESETS.length - 1, Math.max(0, Math.round(Number(stored.presetIndex) || 0))),
      accentFlashEnabled: stored.accentFlashEnabled !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function meterGroups(beatsPerBar: number): number[] {
  const known: Record<number, number[]> = {
    2: [2],
    3: [3],
    4: [4],
    5: [3, 2],
    6: [3, 3],
    7: [4, 3],
    8: [4, 4],
    9: [3, 3, 3],
    10: [5, 5],
    11: [4, 4, 3],
    12: [4, 4, 4],
  };
  return known[beatsPerBar] ?? [beatsPerBar];
}

export default function MetronomePage() {
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
  const [presetIndex, setPresetIndex] = useState(initial.presetIndex);
  const [accentFlashEnabled, setAccentFlashEnabled] = useState(initial.accentFlashEnabled);
  const [running, setRunning] = useState(false);
  const [beatInBar, setBeatInBar] = useState(0);
  const [subdivisionInBeat, setSubdivisionInBeat] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audible, setAudible] = useState(true);
  const [flashPulse, setFlashPulse] = useState(0);
  const [notice, setNotice] = useState('');

  const voiceSupported = isKoreanCountVoiceSupported();
  const voiceRef = useRef({ countMode, bpm, volume, accentVolume, accents });
  voiceRef.current = { countMode, bpm, volume, accentVolume, accents };

  const settings = useMemo<StandaloneMetronomeSettings>(() => ({
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
  }), [accentVolume, accents, beatsPerBar, bpm, gapEnabled, gapMuteBars, gapPlayBars, sound, subdivision, subdivisionVolume, swing, volume]);

  const engineSettings = useMemo<StandaloneMetronomeSettings>(() => {
    if (countMode !== 'voice' || !voiceSupported) return settings;
    return { ...settings, volume: 0, accentVolume: 0, subdivisionVolume: 0 };
  }, [countMode, settings, voiceSupported]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    stopKoreanCountVoice();
    releasePlaybackAudioSession();
    setRunning(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...settings,
      countMode,
      trainerEnabled,
      trainerTarget,
      trainerStep,
      trainerBars,
      timerMinutes,
      presetIndex,
      accentFlashEnabled,
    }));
  }, [accentFlashEnabled, countMode, presetIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);

  useEffect(() => engineRef.current.update(engineSettings), [engineSettings]);

  useEffect(() => {
    setAccents((current) => Array.from({ length: beatsPerBar }, (_, index) => current[index] ?? index === 0));
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

  useEffect(() => () => {
    engineRef.current.stop();
    stopKoreanCountVoice();
    releasePlaybackAudioSession();
  }, []);

  const start = useCallback(async () => {
    setNotice('');
    barCountRef.current = 0;
    setBarCount(0);
    setElapsedSeconds(0);
    primeKoreanCountVoice();
    try {
      await Promise.all([
        preparePlaybackAudioSession(),
        engineRef.current.start(engineSettings, (tick) => {
          setBeatInBar(tick.beatInBar);
          setSubdivisionInBeat(tick.subdivisionInBeat);
          setAudible(tick.audible);
          const accent = tick.subdivisionInBeat === 0 && Boolean(voiceRef.current.accents[tick.beatInBar]);
          if (accentFlashEnabled && tick.audible && accent) setFlashPulse((value) => value + 1);

          const voice = voiceRef.current;
          if (tick.audible && tick.subdivisionInBeat === 0 && voice.countMode !== 'click' && isKoreanCountVoiceSupported()) {
            speakKoreanCount(tick.beatInBar, voice.bpm, voice.accents[tick.beatInBar] ? voice.accentVolume : voice.volume);
          }

          if (tick.beatInBar === 0 && tick.subdivisionInBeat === 0) {
            const nextBars = barCountRef.current + 1;
            barCountRef.current = nextBars;
            setBarCount(nextBars);
            if (trainerEnabled && nextBars % Math.max(1, trainerBars) === 0) {
              setBpm((current) => Math.min(clampBpm(trainerTarget), current + Math.max(1, trainerStep)));
            }
          }
        }),
      ]);
      setRunning(true);
    } catch (error) {
      releasePlaybackAudioSession();
      setNotice(error instanceof Error ? error.message : '메트로놈을 시작할 수 없습니다.');
    }
  }, [accentFlashEnabled, engineSettings, trainerBars, trainerEnabled, trainerStep, trainerTarget]);

  const tapTempo = () => {
    const now = performance.now();
    const recent = tapTimesRef.current.filter((time) => now - time < 2500);
    recent.push(now);
    tapTimesRef.current = recent.slice(-8);
    if (tapTimesRef.current.length < 2) return;
    const intervals = tapTimesRef.current.slice(1).map((time, index) => time - tapTimesRef.current[index]);
    setBpm(clampBpm(60000 / (intervals.reduce((sum, value) => sum + value, 0) / intervals.length)));
  };

  const testVoice = async () => {
    await preparePlaybackAudioSession();
    primeKoreanCountVoice();
    setNotice(speakKoreanCount(0, bpm, accentVolume) ? '한국어 카운트 음성을 재생했습니다.' : '한국어 음성을 지원하지 않는 브라우저입니다.');
  };

  const preset = PRACTICE_PRESETS[presetIndex];
  const applyPreset = () => {
    if (running) stop();
    setBpm(preset.bpm);
    setBeatsPerBar(4);
    setSubdivision(preset.subdivision);
    setAccents([...preset.accents]);
    setGapEnabled(preset.gap);
    setTimerMinutes(preset.timer);
    setNotice(`${preset.name} 설정을 적용했습니다.`);
  };

  const visualSubdivision = getVisualSubdivision(subdivision);
  const groups = useMemo(() => buildSubdivisionCountGroups(beatsPerBar, visualSubdivision), [beatsPerBar, visualSubdivision]);
  const currentCount = getCurrentSubdivisionCount(beatInBar, subdivisionInBeat, subdivision);
  const activeVisualIndex = getVisualSubdivisionIndex(subdivision, subdivisionInBeat);
  const progress = timerMinutes > 0 ? Math.min(100, elapsedSeconds / (timerMinutes * 60) * 100) : 0;
  const selectedSound = SOUND_OPTIONS.find((item) => item.value === sound) ?? SOUND_OPTIONS[0];
  const grouping = meterGroups(beatsPerBar);
  const guideStyle = { '--meter-columns': Math.min(4, beatsPerBar) } as CSSProperties;

  let beatCursor = 0;
  const groupedBeats = grouping.map((groupSize, groupIndex) => {
    const start = beatCursor;
    beatCursor += groupSize;
    return { groupSize, groupIndex, beats: Array.from({ length: groupSize }, (_, index) => start + index) };
  });

  return (
    <div className="metronome-lab-page">
      <header className="lab-header">
        <div className="metronome-page-nav">
          <button type="button" className="secondary-button" onClick={() => { window.location.hash = ''; }}>← 영상 연습</button>
          <button type="button" className="secondary-button" onClick={() => { window.location.hash = 'drummer-training'; }}>드럼 트레이닝</button>
        </div>
        <div><span className="eyebrow">BARLOOP LAB</span><h1>드러머 메트로놈</h1><p>2~12박 클릭·카운트·Gap Click·템포 훈련에 집중하는 독립 메트로놈</p></div>
        <div className={running ? 'lab-live active' : 'lab-live'}>{running ? 'RUNNING' : 'READY'}</div>
      </header>

      <main className="lab-layout">
        <section className="lab-stage panel">
          <div className="meter-stage-status"><strong>{beatsPerBar}/4</strong><span>{grouping.join('+')} 묶음</span></div>
          <div className={audible ? 'beat-orbit' : 'beat-orbit muted'}>
            {accentFlashEnabled && flashPulse > 0 && <i key={flashPulse} className="accent-flash-wave metronome-flash" />}
            <div className="beat-number current-count-position">{currentCount}</div>
            <span>{audible ? (countMode === 'voice' ? 'VOICE' : countMode === 'both' ? 'BOTH' : 'CLICK') : 'GAP'}</span>
          </div>
          <div className="lab-bpm-row"><button type="button" onClick={() => setBpm((value) => clampBpm(value - 1))}>−</button><div className="lab-bpm-input"><BpmNumberInput value={bpm} onChange={setBpm} ariaLabel="메트로놈 BPM" /><strong>BPM</strong></div><button type="button" onClick={() => setBpm((value) => clampBpm(value + 1))}>＋</button></div>

          <div className="meter-progress-readout">현재 <strong>{beatInBar + 1}</strong> / {beatsPerBar}박</div>
          <div className="meter-group-overview" aria-label="현재 박자">
            {groupedBeats.map(({ groupIndex, groupSize, beats }) => (
              <section key={groupIndex} className="meter-overview-group">
                <b>{groupSize}박 묶음</b>
                <div>{beats.map((beatIndex) => <i key={beatIndex} className={beatIndex === beatInBar ? 'active' : ''}>{beatIndex + 1}</i>)}</div>
              </section>
            ))}
          </div>

          <div className="subdivision-meter">{Array.from({ length: subdivision }, (_, index) => <i key={index} className={index === subdivisionInBeat ? 'active' : ''} />)}</div>
          <div className="subdivision-count-guide variable-meter-guide" style={guideStyle} aria-label="한 마디 서브디비전 카운트">
            {groups.map((labels, beatIndex) => (
              <div key={beatIndex} className={beatIndex === beatInBar ? 'count-beat-group active-beat' : 'count-beat-group'}>
                <b>{beatIndex + 1}박</b>
                <section>
                  {labels.map((label, subIndex) => (
                    <span key={`${beatIndex}-${subIndex}`} className={[
                      isSubdivisionSoundCell(subdivision, subIndex) ? 'sound-on' : 'guide-only',
                      subIndex > 0 ? 'offbeat-guide' : 'downbeat-guide',
                      beatIndex === beatInBar && subIndex === activeVisualIndex ? 'active' : '',
                    ].filter(Boolean).join(' ')}>{label}</span>
                  ))}
                </section>
              </div>
            ))}
          </div>

          <div className="lab-primary-actions"><button id="metronome-toggle" type="button" className="primary-button" onClick={running ? stop : start}>{running ? '정지' : '시작'}</button><button type="button" className="secondary-button" onClick={tapTempo}>TAP TEMPO</button></div>
          <div className="quick-bpm-row">{[60, 80, 100, 120, 140, 160, 180].map((value) => <button key={value} type="button" className={bpm === value ? 'active' : ''} onClick={() => setBpm(value)}>{value}</button>)}</div>
          <div className="lab-session-strip"><span>시간 <strong>{formatClock(elapsedSeconds)}</strong></span><span>마디 <strong>{barCount}</strong></span><span>목표 <strong>{timerMinutes ? `${timerMinutes}분` : '없음'}</strong></span></div>
          <div className="lab-progress"><i style={{ width: `${progress}%` }} /></div>
          {notice && <p className="lab-notice">{notice}</p>}
        </section>

        <div className="lab-controls">
          <section className="panel lab-panel">
            <div className="section-title-row"><h2>박자와 악센트</h2><label className="switch-label"><input type="checkbox" checked={accentFlashEnabled} onChange={(event) => setAccentFlashEnabled(event.target.checked)} /><span>강세 플래시</span></label></div>
            <div className="compact-grid three">
              <label>박자 수<select value={beatsPerBar} onChange={(event) => setBeatsPerBar(Number(event.target.value))}>{Array.from({ length: 11 }, (_, index) => index + 2).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>서브디비전<select value={subdivision} onChange={(event) => setSubdivision(Number(event.target.value) as MetronomeSubdivision)}><option value={1}>4분음표</option><option value={2}>8분음표</option><option value={3}>셋잇단</option><option value={4}>16분음표</option></select></label>
              <label>스윙<select value={swing} disabled={subdivision === 1 || subdivision === 3} onChange={(event) => setSwing(Number(event.target.value))}>{SWING_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <p className="meter-grouping-hint">{beatsPerBar}/4 추천 묶음: <strong>{grouping.join(' + ')}</strong>. 각 묶음의 시작 박을 강세로 켜면 긴 마디가 더 잘 들립니다.</p>
            <div className="accent-sequencer variable-accent-sequencer" style={guideStyle}>
              {accents.map((active, index) => <button key={index} type="button" className={active ? 'active' : ''} onClick={() => setAccents((current) => current.map((value, item) => item === index ? !value : value))}><strong>{index + 1}</strong><span>{active ? '강세' : '보통'}</span></button>)}
            </div>
          </section>

          <section className="panel lab-panel">
            <div className="section-title-row"><h2>오디오 믹서</h2><span>{selectedSound.label}</span></div>
            <div className="compact-grid two">
              <label>메인 박 출력<select value={countMode} onChange={(event) => setCountMode(event.target.value as CountVoiceMode)}><option value="click">클릭음</option><option value="voice">한국어 카운트</option><option value="both">클릭 + 한국어 카운트</option></select></label>
              <label>클릭 음색<select value={sound} disabled={countMode === 'voice'} onChange={(event) => setSound(event.target.value as MetronomeSound)}>{SOUND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>기본 클릭 {Math.round(volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={volume} disabled={countMode === 'voice'} onChange={(event) => setVolume(Number(event.target.value))} /></label>
              <label>강세·음성 {Math.round(accentVolume * 100)}%<input type="range" min={0} max={1} step={0.01} value={accentVolume} onChange={(event) => setAccentVolume(Number(event.target.value))} /></label>
              <label>서브디비전 {Math.round(subdivisionVolume * 100)}%<input type="range" min={0} max={1} step={0.01} value={subdivisionVolume} disabled={countMode === 'voice'} onChange={(event) => setSubdivisionVolume(Number(event.target.value))} /></label>
            </div>
            <p className="hint">{selectedSound.description}</p>
            <button type="button" className="secondary-button full-width" onClick={() => void testVoice()}>한국어 음성 테스트 · 하나</button>
          </section>

          <section className="panel lab-panel"><div className="section-title-row"><h2>Gap Click</h2><label className="switch-label"><input type="checkbox" checked={gapEnabled} onChange={(event) => setGapEnabled(event.target.checked)} /><span>사용</span></label></div><div className="compact-grid two"><label>클릭 마디<input type="number" min={1} max={32} value={gapPlayBars} onChange={(event) => setGapPlayBars(Math.max(1, Number(event.target.value)))} /></label><label>무음 마디<input type="number" min={1} max={32} value={gapMuteBars} onChange={(event) => setGapMuteBars(Math.max(1, Number(event.target.value)))} /></label></div></section>
          <section className="panel lab-panel"><div className="section-title-row"><h2>템포 트레이너</h2><label className="switch-label"><input type="checkbox" checked={trainerEnabled} onChange={(event) => setTrainerEnabled(event.target.checked)} /><span>자동 증가</span></label></div><div className="compact-grid three"><label>목표 BPM<BpmNumberInput value={trainerTarget} onChange={setTrainerTarget} ariaLabel="목표 BPM" /></label><label>증가 폭<input type="number" min={1} max={30} value={trainerStep} onChange={(event) => setTrainerStep(Math.max(1, Number(event.target.value)))} /></label><label>증가 주기<input type="number" min={1} max={64} value={trainerBars} onChange={(event) => setTrainerBars(Math.max(1, Number(event.target.value)))} /></label></div></section>
          <section className="panel lab-panel practice-preset-panel"><div className="section-title-row"><h2>연습 프리셋</h2><select aria-label="연습 프리셋 선택" value={presetIndex} onChange={(event) => setPresetIndex(Number(event.target.value))}>{PRACTICE_PRESETS.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></div><button type="button" className="primary-button" onClick={applyPreset}>이 설정으로 연습 준비</button></section>
          <section className="panel lab-panel"><div className="section-title-row"><h2>연습 타이머</h2><span>{timerMinutes ? `${timerMinutes}분` : '무제한'}</span></div><div className="quick-bpm-row">{[0, 5, 10, 15, 20, 30].map((value) => <button key={value} type="button" className={timerMinutes === value ? 'active' : ''} onClick={() => setTimerMinutes(value)}>{value === 0 ? '∞' : `${value}분`}</button>)}</div></section>
        </div>
      </main>
    </div>
  );
}
