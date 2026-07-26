import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeBpmText } from '../lib/bpm';
import {
  addPracticeSession,
  getWeeklySummary,
  readPracticeHistory,
  removePracticeSession,
  restorePracticeHistoryFromDatabase,
  type PracticeSession,
} from '../lib/practiceHistory';

const SETTINGS_KEY = 'barloop:coach-settings:v1';

interface CoachSettings {
  targetMinutes: number;
  workMinutes: number;
  restSeconds: number;
  autoRest: boolean;
}

const DEFAULT_SETTINGS: CoachSettings = {
  targetMinutes: 20,
  workMinutes: 5,
  restSeconds: 30,
  autoRest: true,
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function beep(frequency: number, duration = 0.12): void {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.16, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
  oscillator.addEventListener('ended', () => void context.close());
}

export default function PracticeCoach() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [resting, setResting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [label, setLabel] = useState('자유 연습');
  const [note, setNote] = useState('');
  const [startBpm, setStartBpm] = useState('');
  const [bestBpm, setBestBpm] = useState('');
  const [history, setHistory] = useState<PracticeSession[]>(readPracticeHistory);
  const [settings, setSettings] = useState<CoachSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const startedAtRef = useRef<string | null>(null);
  const phaseLimit = resting ? settings.restSeconds : settings.workMinutes * 60;
  const targetSeconds = settings.targetMinutes * 60;
  const summary = useMemo(() => getWeeklySummary(history), [history]);

  useEffect(() => {
    void restorePracticeHistoryFromDatabase().then(setHistory);
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed((value) => value + (resting ? 0 : 1));
      setPhaseElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [resting, running]);

  useEffect(() => {
    if (!running || phaseElapsed < phaseLimit) return;
    beep(resting ? 880 : 660, 0.2);
    if (resting) {
      setResting(false);
      setPhaseElapsed(0);
    } else if (settings.autoRest && settings.restSeconds > 0) {
      setResting(true);
      setPhaseElapsed(0);
    } else {
      setPhaseElapsed(0);
    }
  }, [phaseElapsed, phaseLimit, resting, running, settings.autoRest, settings.restSeconds]);

  useEffect(() => {
    if (running && elapsed === targetSeconds) beep(1040, 0.3);
  }, [elapsed, running, targetSeconds]);

  const start = () => {
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
    setRunning(true);
    beep(520);
  };

  const finish = (completed: boolean) => {
    setRunning(false);
    const session: PracticeSession = {
      id: crypto.randomUUID(),
      startedAt: startedAtRef.current || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      activeSeconds: elapsed,
      label: label.trim() || '자유 연습',
      startBpm: Number(startBpm) || undefined,
      bestBpm: Number(bestBpm) || undefined,
      completed,
      note: note.trim(),
    };
    setHistory(addPracticeSession(session));
    startedAtRef.current = null;
    setElapsed(0);
    setPhaseElapsed(0);
    setResting(false);
    setNote('');
    beep(completed ? 1200 : 420, 0.25);
  };

  return (
    <div className={open ? 'practice-coach open' : 'practice-coach'}>
      <button className="coach-fab" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? '닫기' : '연습 코치'}
      </button>
      {open && (
        <section className="coach-sheet" aria-label="연습 코치">
          <header>
            <div>
              <span className="eyebrow">PRACTICE COACH</span>
              <h2>{resting ? '휴식 중' : running ? '연습 중' : '연습 세션'}</h2>
            </div>
            <strong className={resting ? 'coach-timer rest' : 'coach-timer'}>{formatDuration(resting ? Math.max(0, phaseLimit - phaseElapsed) : elapsed)}</strong>
          </header>

          <div className="coach-progress"><i style={{ width: `${Math.min(100, (elapsed / Math.max(1, targetSeconds)) * 100)}%` }} /></div>
          <p className="coach-status">목표 {settings.targetMinutes}분 · 이번 구간 {formatDuration(phaseElapsed)} / {formatDuration(phaseLimit)}</p>

          <div className="coach-grid">
            <label>세션 이름<input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
            <label>목표 시간<select value={settings.targetMinutes} onChange={(event) => setSettings({ ...settings, targetMinutes: Number(event.target.value) })}>{[10, 15, 20, 30, 45, 60].map((value) => <option key={value} value={value}>{value}분</option>)}</select></label>
            <label>연주 구간<select value={settings.workMinutes} onChange={(event) => setSettings({ ...settings, workMinutes: Number(event.target.value) })}>{[1, 3, 5, 10, 15].map((value) => <option key={value} value={value}>{value}분</option>)}</select></label>
            <label>휴식<select value={settings.restSeconds} onChange={(event) => setSettings({ ...settings, restSeconds: Number(event.target.value) })}>{[0, 15, 30, 45, 60, 120].map((value) => <option key={value} value={value}>{value}초</option>)}</select></label>
            <label>시작 BPM<input inputMode="numeric" value={startBpm} onChange={(event) => setStartBpm(normalizeBpmText(event.target.value))} /></label>
            <label>최고 BPM<input inputMode="numeric" value={bestBpm} onChange={(event) => setBestBpm(normalizeBpmText(event.target.value))} /></label>
          </div>
          <label className="coach-check"><input type="checkbox" checked={settings.autoRest} onChange={(event) => setSettings({ ...settings, autoRest: event.target.checked })} />연주 구간 뒤 자동 휴식</label>
          <label>메모<textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="오늘 불편했던 패턴이나 다음 목표" /></label>

          <div className="coach-actions">
            {!running ? <button type="button" className="primary-button" onClick={start}>{elapsed ? '계속하기' : '시작'}</button> : <button type="button" className="secondary-button" onClick={() => setRunning(false)}>일시정지</button>}
            <button type="button" disabled={elapsed === 0} onClick={() => finish(true)}>완료 저장</button>
            <button type="button" disabled={elapsed === 0} onClick={() => finish(false)}>중단 저장</button>
          </div>

          <div className="coach-summary">
            <div><strong>{summary.sessions}</strong><span>최근 7일 세션</span></div>
            <div><strong>{Math.round(summary.totalSeconds / 60)}분</strong><span>총 연습</span></div>
            <div><strong>{summary.completed}</strong><span>완료</span></div>
            <div><strong>{summary.bestBpm || '—'}</strong><span>최고 BPM</span></div>
          </div>

          <details>
            <summary>최근 연습 기록</summary>
            <div className="coach-history">
              {history.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <div><strong>{item.label}</strong><span>{new Date(item.startedAt).toLocaleDateString('ko-KR')} · {Math.round(item.activeSeconds / 60)}분 {item.bestBpm ? `· ${item.bestBpm} BPM` : ''}</span></div>
                  <button type="button" onClick={() => setHistory(removePracticeSession(item.id))}>삭제</button>
                </article>
              ))}
              {!history.length && <p>아직 저장된 연습 기록이 없습니다.</p>}
            </div>
          </details>
          <p className="utility-note">최근 기록은 localStorage와 브라우저 IndexedDB에 함께 보관됩니다.</p>
        </section>
      )}
    </div>
  );
}
