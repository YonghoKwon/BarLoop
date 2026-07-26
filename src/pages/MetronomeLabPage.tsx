import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BpmNumberInput from '../components/BpmNumberInput';
import { clampBpm } from '../lib/bpm';
import {
  StandaloneMetronomeEngine,
  type MetronomeSound,
  type MetronomeSubdivision,
  type StandaloneMetronomeSettings,
} from '../lib/standaloneMetronome';

const STORAGE_KEY = 'barloop:metronome-lab:v1';

const RUDIMENTS = [
  { name: 'Single Stroke', sticking: 'R L R L  R L R L', accent: '>       >' },
  { name: 'Double Stroke', sticking: 'R R L L  R R L L', accent: '>       >' },
  { name: 'Paradiddle', sticking: 'R L R R  L R L L', accent: '>       >' },
  { name: 'Double Paradiddle', sticking: 'R L R L R R  L R L R L L', accent: '>           >' },
  { name: 'Paradiddle-diddle', sticking: 'R L R R L L  L R L L R R', accent: '>           >' },
  { name: 'Six Stroke Roll', sticking: 'R L L R R L  L R R L L R', accent: '>         >' },
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
  accents: boolean[];
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
  trainerEnabled: boolean;
  trainerTarget: number;
  trainerStep: number;
  trainerBars: number;
  timerMinutes: number;
  rudimentIndex: number;
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
  accents: [true, false, false, false],
  gapEnabled: false,
  gapPlayBars: 4,
  gapMuteBars: 2,
  trainerEnabled: false,
  trainerTarget: 140,
  trainerStep: 5,
  trainerBars: 4,
  timerMinutes: 10,
  rudimentIndex: 2,
};

function readSettings(): StoredLabSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<StoredLabSettings>;
    const beatsPerBar = Math.min(12, Math.max(2, Math.round(Number(stored.beatsPerBar) || 4)));
    return {
      ...DEFAULTS,
      ...stored,
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
  const [accents, setAccents] = useState(initial.accents);
  const [gapEnabled, setGapEnabled] = useState(initial.gapEnabled);
  const [gapPlayBars, setGapPlayBars] = useState(initial.gapPlayBars);
  const [gapMuteBars, setGapMuteBars] = useState(initial.gapMuteBars);
  const [trainerEnabled, setTrainerEnabled] = useState(initial.trainerEnabled);
  const [trainerTarget, setTrainerTarget] = useState(initial.trainerTarget);
  const [trainerStep, setTrainerStep] = useState(initial.trainerStep);
  const [trainerBars, setTrainerBars] = useState(initial.trainerBars);
  const [timerMinutes, setTimerMinutes] = useState(initial.timerMinutes);
  const [rudimentIndex, setRudimentIndex] = useState(initial.rudimentIndex);
  const [running, setRunning] = useState(false);
  const [beatInBar, setBeatInBar] = useState(0);
  const [subdivisionInBeat, setSubdivisionInBeat] = useState(0);
  const [barCount, setBarCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audible, setAudible] = useState(true);
  const [notice, setNotice] = useState('');

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

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...settings,
        trainerEnabled,
        trainerTarget,
        trainerStep,
        trainerBars,
        timerMinutes,
        rudimentIndex,
      }),
    );
  }, [rudimentIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);

  useEffect(() => {
    engineRef.current.update(settings);
  }, [settings]);

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
          engineRef.current.stop();
          setRunning(false);
          setNotice(`${timerMinutes}분 연습 목표를 완료했습니다.`);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, timerMinutes]);

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

  useEffect(() => () => engineRef.current.stop(), []);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    setNotice('');
    barCountRef.current = 0;
    setBarCount(0);
    setElapsedSeconds(0);
    try {
      await engineRef.current.start(settings, (tick) => {
        setBeatInBar(tick.beatInBar);
        setSubdivisionInBeat(tick.subdivisionInBeat);
        setAudible(tick.audible);
        if (tick.beatInBar === 0 && tick.subdivisionInBeat === 0) {
          const nextBars = barCountRef.current + 1;
          barCountRef.current = nextBars;
          setBarCount(nextBars);
          if (trainerEnabled && nextBars % Math.max(1, trainerBars) === 0) {
            setBpm((current) => Math.min(clampBpm(trainerTarget), current + Math.max(1, trainerStep)));
          }
        }
      });
      setRunning(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '메트로놈을 시작할 수 없습니다.');
    }
  }, [settings, trainerBars, trainerEnabled, trainerStep, trainerTarget]);

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

  const rudiment = RUDIMENTS[Math.min(RUDIMENTS.length - 1, Math.max(0, rudimentIndex))];
  const progress = timerMinutes > 0 ? Math.min(100, (elapsedSeconds / (timerMinutes * 60)) * 100) : 0;

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
            <div className="beat-number">{beatInBar + 1}</div>
            <span>{audible ? 'CLICK' : 'GAP'}</span>
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
            <div className="section-title-row"><h2>오디오 믹서</h2><span>{sound}</span></div>
            <div className="compact-grid two">
              <label>클릭 음색
                <select value={sound} onChange={(event) => setSound(event.target.value as MetronomeSound)}>
                  <option value="classic">Classic</option><option value="wood">Wood</option><option value="rim">Rim</option><option value="cowbell">Cowbell</option>
                </select>
              </label>
              <label>기본 클릭 {Math.round(volume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
              </label>
              <label>강세 {Math.round(accentVolume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={accentVolume} onChange={(event) => setAccentVolume(Number(event.target.value))} />
              </label>
              <label>서브디비전 {Math.round(subdivisionVolume * 100)}%
                <input type="range" min={0} max={1} step={0.01} value={subdivisionVolume} onChange={(event) => setSubdivisionVolume(Number(event.target.value))} />
              </label>
            </div>
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

          <section className="panel lab-panel rudiment-panel">
            <div className="section-title-row"><h2>러디먼트</h2><select value={rudimentIndex} onChange={(event) => setRudimentIndex(Number(event.target.value))}>{RUDIMENTS.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></div>
            <div className="sticking-display"><strong>{rudiment.sticking}</strong><span>{rudiment.accent}</span></div>
            <p className="hint">메트로놈과 함께 손 순서와 악센트를 반복하세요.</p>
          </section>

          <section className="panel lab-panel">
            <div className="section-title-row"><h2>연습 타이머</h2><span>{timerMinutes ? `${timerMinutes}분` : '무제한'}</span></div>
            <div className="quick-bpm-row">
              {[0, 5, 10, 15, 20, 30].map((value) => <button key={value} type="button" className={timerMinutes === value ? 'active' : ''} onClick={() => setTimerMinutes(value)}>{value === 0 ? '∞' : `${value}분`}</button>)}
            </div>
          </section>
        </div>
      </main>

      <footer className="lab-footer">Space 시작/정지 · +/− BPM 조절 · 설정은 이 브라우저에 자동 저장됩니다.</footer>
    </div>
  );
}
