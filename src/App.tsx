import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react';
import LocalMediaPlayer from './components/LocalMediaPlayer';
import YouTubePlayer from './components/YouTubePlayer';
import { clamp, extractYouTubeId, formatTime, generateBars } from './lib/time';
import type { BarSegment, LoopMode, PlayerHandle, SourceType } from './types';

const SPEEDS = [0.5, 0.65, 0.75, 0.85, 1, 1.25, 1.5, 2];
const SETTINGS_KEY = 'barloop:practice-settings:v2';

interface StoredSettings {
  bpm: number;
  beatsPerBar: number;
  playbackRate: number;
  loopEnabled: boolean;
}

interface LocalFileState {
  name: string;
  size: number;
  url: string;
  kind: 'audio' | 'video';
  mimeType: string;
}

const DEFAULT_SETTINGS: StoredSettings = {
  bpm: 120,
  beatsPerBar: 4,
  playbackRate: 1,
  loopEnabled: true,
};

function readStoredSettings(): StoredSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;

    return {
      bpm: clamp(Math.round(Number(parsed.bpm) || DEFAULT_SETTINGS.bpm), 20, 400),
      beatsPerBar: [2, 3, 4, 5, 6, 7, 8, 12].includes(Number(parsed.beatsPerBar))
        ? Number(parsed.beatsPerBar)
        : DEFAULT_SETTINGS.beatsPerBar,
      playbackRate: SPEEDS.includes(Number(parsed.playbackRate))
        ? Number(parsed.playbackRate)
        : DEFAULT_SETTINGS.playbackRate,
      loopEnabled:
        typeof parsed.loopEnabled === 'boolean'
          ? parsed.loopEnabled
          : DEFAULT_SETTINGS.loopEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeBpmInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return String(Number(digits));
}

function detectMediaKind(file: File): 'audio' | 'video' | null {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'].includes(extension)) {
    return 'audio';
  }
  if (extension && ['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(extension)) {
    return 'video';
  }
  return null;
}

function App() {
  const initialSettingsRef = useRef(readStoredSettings());
  const playerRef = useRef<PlayerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loopGuardRef = useRef(0);
  const localFileRef = useRef<LocalFileState | null>(null);
  const tapTimesRef = useRef<number[]>([]);

  const [sourceType, setSourceType] = useState<SourceType>('youtube');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<LocalFileState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(initialSettingsRef.current.playbackRate);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [bpmInput, setBpmInput] = useState(String(initialSettingsRef.current.bpm));
  const [beatsPerBar, setBeatsPerBar] = useState(initialSettingsRef.current.beatsPerBar);
  const [firstDownbeat, setFirstDownbeat] = useState(0);
  const [bars, setBars] = useState<BarSegment[]>([]);
  const [selectedBarStart, setSelectedBarStart] = useState(0);
  const [selectedBarEnd, setSelectedBarEnd] = useState(0);
  const [tapCount, setTapCount] = useState(0);

  const [loopMode, setLoopMode] = useState<LoopMode>('bars');
  const [loopEnabled, setLoopEnabled] = useState(initialSettingsRef.current.loopEnabled);
  const [timeLoopStart, setTimeLoopStart] = useState(0);
  const [timeLoopEnd, setTimeLoopEnd] = useState(8);
  const [loopCount, setLoopCount] = useState(0);

  const bpm = Number(bpmInput);
  const hasActiveSource = sourceType === 'youtube' ? Boolean(youtubeVideoId) : Boolean(localFile);

  const selectedBars = useMemo(() => {
    if (bars.length === 0) return null;
    const startIndex = Math.floor(clamp(selectedBarStart, 0, bars.length - 1));
    const endIndex = Math.floor(clamp(selectedBarEnd, startIndex, bars.length - 1));
    return {
      startIndex,
      endIndex,
      start: bars[startIndex].start,
      end: bars[endIndex].end,
    };
  }, [bars, selectedBarEnd, selectedBarStart]);

  const activeLoop = useMemo(() => {
    if (loopMode === 'bars' && selectedBars) {
      return { start: selectedBars.start, end: selectedBars.end };
    }
    return {
      start: clamp(timeLoopStart, 0, duration || Number.MAX_SAFE_INTEGER),
      end: clamp(timeLoopEnd, 0, duration || Number.MAX_SAFE_INTEGER),
    };
  }, [duration, loopMode, selectedBars, timeLoopEnd, timeLoopStart]);

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const resetPlaybackState = useCallback(() => {
    playerRef.current?.pause();
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBars([]);
    setSelectedBarStart(0);
    setSelectedBarEnd(0);
    setTimeLoopStart(0);
    setTimeLoopEnd(8);
    setLoopCount(0);
    setError('');
    setNotice('');
  }, []);

  const switchSource = (nextSource: SourceType) => {
    if (sourceType === nextSource) return;
    resetPlaybackState();
    setSourceType(nextSource);
  };

  const handleReady = useCallback((nextDuration: number) => {
    const safeDuration = Number.isFinite(nextDuration) ? nextDuration : 0;
    setDuration(safeDuration);
    setCurrentTime(0);
    setTimeLoopStart(0);
    setTimeLoopEnd(Math.min(8, safeDuration));
    setFirstDownbeat(0);
    setBars([]);
    setLoopCount(0);
    setIsReady(true);
    setError('');
    setNotice('미디어를 불러왔습니다. 첫 박자를 맞춘 뒤 마디를 나눠 보세요.');
  }, []);

  const handlePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handlePlayerError = useCallback((message: string) => {
    setError(message);
    setNotice('');
    setIsReady(false);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    localFileRef.current = localFile;
  }, [localFile]);

  useEffect(
    () => () => {
      if (localFileRef.current) URL.revokeObjectURL(localFileRef.current.url);
    },
    [],
  );

  useEffect(() => {
    const settings: StoredSettings = {
      bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_SETTINGS.bpm,
      beatsPerBar,
      playbackRate,
      loopEnabled,
    };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [beatsPerBar, bpm, loopEnabled, playbackRate]);

  useEffect(() => {
    setLoopCount(0);
  }, [activeLoop.end, activeLoop.start, loopMode]);

  useEffect(() => {
    if (!isReady) return;

    let animationFrame = 0;
    const tick = () => {
      const player = playerRef.current;
      if (player) {
        const nextTime = player.getCurrentTime();
        const nextDuration = player.getDuration();

        if (Number.isFinite(nextTime)) setCurrentTime(nextTime);
        if (Number.isFinite(nextDuration) && nextDuration > 0) {
          setDuration((previous) =>
            Math.abs(previous - nextDuration) > 0.2 ? nextDuration : previous,
          );
        }

        const loopLength = activeLoop.end - activeLoop.start;
        const now = performance.now();
        if (
          loopEnabled &&
          isPlaying &&
          loopLength > 0.04 &&
          nextTime >= activeLoop.end - 0.025 &&
          now - loopGuardRef.current > 120
        ) {
          loopGuardRef.current = now;
          player.seekTo(activeLoop.start);
          void player.play();
          setCurrentTime(activeLoop.start);
          setLoopCount((count) => count + 1);
        }
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeLoop.end, activeLoop.start, isPlaying, isReady, loopEnabled]);

  const seekTo = useCallback(
    (seconds: number) => {
      const safeTime = clamp(seconds, 0, duration || 0);
      playerRef.current?.seekTo(safeTime);
      setCurrentTime(safeTime);
    },
    [duration],
  );

  const togglePlayback = useCallback(() => {
    if (!isReady) return;
    if (isPlaying) playerRef.current?.pause();
    else void playerRef.current?.play();
  }, [isPlaying, isReady]);

  const seekBy = useCallback(
    (seconds: number) => {
      seekTo(currentTime + seconds);
    },
    [currentTime, seekTo],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button')) return;

      if (event.code === 'Space') {
        event.preventDefault();
        togglePlayback();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seekBy(event.shiftKey ? -0.1 : -5);
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        seekBy(event.shiftKey ? 0.1 : 5);
      } else if (event.key.toLowerCase() === 'l') {
        setLoopEnabled((enabled) => !enabled);
      } else if (event.key === '[') {
        setLoopMode('time');
        setTimeLoopStart(currentTime);
      } else if (event.key === ']') {
        setLoopMode('time');
        setTimeLoopEnd(currentTime);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTime, seekBy, togglePlayback]);

  const loadYouTubeVideo = () => {
    const videoId = extractYouTubeId(youtubeInput);
    if (!videoId) {
      setError('올바른 YouTube URL 또는 11자리 영상 ID를 입력해 주세요.');
      setNotice('');
      return;
    }

    resetPlaybackState();
    setYoutubeVideoId(videoId);
  };

  const loadLocalFile = (file: File) => {
    const kind = detectMediaKind(file);
    if (!kind) {
      setError('재생 가능한 영상 또는 음원 파일을 선택해 주세요.');
      setNotice('');
      return;
    }

    resetPlaybackState();
    if (localFileRef.current) URL.revokeObjectURL(localFileRef.current.url);

    const nextFile: LocalFileState = {
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
      kind,
      mimeType: file.type || 'unknown',
    };
    localFileRef.current = nextFile;
    setLocalFile(nextFile);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) loadLocalFile(file);
  };

  const handleBpmChange = (value: string) => {
    setBpmInput(normalizeBpmInput(value));
    clearMessages();
  };

  const finalizeBpm = () => {
    const safeBpm = clamp(Math.round(Number(bpmInput) || DEFAULT_SETTINGS.bpm), 20, 400);
    setBpmInput(String(safeBpm));
  };

  const adjustBpm = (amount: number) => {
    const safeBpm = clamp(Math.round(Number(bpmInput) || DEFAULT_SETTINGS.bpm) + amount, 20, 400);
    setBpmInput(String(safeBpm));
    clearMessages();
  };

  const tapTempo = () => {
    const now = performance.now();
    const previous = tapTimesRef.current.at(-1);
    let times = tapTimesRef.current;

    if (!previous || now - previous > 2500) times = [];
    times = [...times, now].slice(-8);
    tapTimesRef.current = times;
    setTapCount(times.length);

    if (times.length >= 2) {
      const intervals = times.slice(1).map((time, index) => time - times[index]);
      const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const tappedBpm = clamp(Math.round(60000 / averageInterval), 20, 400);
      setBpmInput(String(tappedBpm));
      setNotice(`${times.length}회 탭 평균으로 ${tappedBpm} BPM을 설정했습니다.`);
      setError('');
    } else {
      setNotice('리듬에 맞춰 두 번 이상 탭해 주세요.');
      setError('');
    }
  };

  const generateBarSegments = () => {
    if (!isReady || duration <= 0) {
      setError('영상 또는 음원을 먼저 불러와 주세요.');
      setNotice('');
      return;
    }
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) {
      setError('BPM은 20~400 사이로 입력해 주세요.');
      setNotice('');
      return;
    }

    const nextBars = generateBars(duration, bpm, beatsPerBar, firstDownbeat);
    setBars(nextBars);
    setSelectedBarStart(0);
    setSelectedBarEnd(0);
    setLoopMode('bars');
    setLoopCount(0);
    setError(nextBars.length ? '' : '마디를 생성할 수 없습니다. 설정값을 확인해 주세요.');
    setNotice(nextBars.length ? `${nextBars.length}개 마디를 생성했습니다.` : '');
    if (nextBars[0]) seekTo(nextBars[0].start);
  };

  const selectBar = (index: number, event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey && selectedBars) {
      setSelectedBarStart(Math.min(selectedBars.startIndex, index));
      setSelectedBarEnd(Math.max(selectedBars.startIndex, index));
    } else {
      setSelectedBarStart(index);
      setSelectedBarEnd(index);
    }
    setLoopMode('bars');
    seekTo(bars[index].start);
  };

  const moveBarSelection = (direction: -1 | 1) => {
    if (!selectedBars || bars.length === 0) return;
    const selectionLength = selectedBars.endIndex - selectedBars.startIndex;
    const maxStart = Math.max(0, bars.length - selectionLength - 1);
    const nextStart = Math.floor(clamp(selectedBars.startIndex + direction, 0, maxStart));
    const nextEnd = nextStart + selectionLength;
    setSelectedBarStart(nextStart);
    setSelectedBarEnd(nextEnd);
    setLoopMode('bars');
    seekTo(bars[nextStart].start);
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    playerRef.current?.setPlaybackRate(rate);
  };

  const setTimeBoundary = (boundary: 'start' | 'end', value: number) => {
    const safeValue = clamp(value, 0, duration);
    setLoopMode('time');
    if (boundary === 'start') {
      setTimeLoopStart(Math.min(safeValue, timeLoopEnd));
    } else {
      setTimeLoopEnd(Math.max(safeValue, timeLoopStart));
    }
  };

  const resetPracticeSettings = () => {
    setBpmInput(String(DEFAULT_SETTINGS.bpm));
    setBeatsPerBar(DEFAULT_SETTINGS.beatsPerBar);
    setPlaybackRate(DEFAULT_SETTINGS.playbackRate);
    playerRef.current?.setPlaybackRate(DEFAULT_SETTINGS.playbackRate);
    setLoopEnabled(DEFAULT_SETTINGS.loopEnabled);
    setFirstDownbeat(0);
    setBars([]);
    setSelectedBarStart(0);
    setSelectedBarEnd(0);
    setTimeLoopStart(0);
    setTimeLoopEnd(Math.min(8, duration || 8));
    setLoopCount(0);
    tapTimesRef.current = [];
    setTapCount(0);
    setError('');
    setNotice('연습 설정을 기본값으로 초기화했습니다.');
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loopLeft = duration > 0 ? (activeLoop.start / duration) * 100 : 0;
  const loopWidth =
    duration > 0 ? Math.max(0, ((activeLoop.end - activeLoop.start) / duration) * 100) : 0;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <div className="brand-row">
            <span className="brand-mark" aria-hidden="true">B</span>
            <h1>BarLoop</h1>
          </div>
          <p>YouTube·영상·음원을 원하는 구간만 반복해서 연습하세요.</p>
        </div>
        <div className="privacy-badge" title="로컬 파일은 서버로 전송되지 않습니다.">
          <span aria-hidden="true">🔒</span>
          로컬 파일은 브라우저에서만 처리
        </div>
      </header>

      <main>
        <section className="panel source-panel">
          <div className="source-tabs" role="tablist" aria-label="미디어 소스">
            <button
              type="button"
              className={sourceType === 'youtube' ? 'source-tab active' : 'source-tab'}
              onClick={() => switchSource('youtube')}
            >
              YouTube
            </button>
            <button
              type="button"
              className={sourceType === 'local' ? 'source-tab active' : 'source-tab'}
              onClick={() => switchSource('local')}
            >
              내 영상·음원
            </button>
          </div>

          {sourceType === 'youtube' ? (
            <div className="source-form">
              <div className="field grow">
                <label htmlFor="youtube-url">YouTube URL 또는 영상 ID</label>
                <input
                  id="youtube-url"
                  type="text"
                  value={youtubeInput}
                  placeholder="https://www.youtube.com/watch?v=..."
                  onChange={(event) => setYoutubeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') loadYouTubeVideo();
                  }}
                />
              </div>
              <button type="button" className="primary-button load-button" onClick={loadYouTubeVideo}>
                불러오기
              </button>
            </div>
          ) : (
            <div
              className={isDragging ? 'drop-zone dragging' : 'drop-zone'}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
              }}
            >
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="video/*,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.mp4,.webm,.mov,.m4v"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) loadLocalFile(file);
                  event.currentTarget.value = '';
                }}
              />
              <span className="drop-icon" aria-hidden="true">＋</span>
              {localFile ? (
                <div>
                  <div className="file-title-row">
                    <strong>{localFile.name}</strong>
                    <span className="media-kind-badge">
                      {localFile.kind === 'audio' ? '음원' : '영상'}
                    </span>
                  </div>
                  <p>{formatBytes(localFile.size)} · 클릭하여 다른 파일 선택</p>
                </div>
              ) : (
                <div>
                  <strong>영상이나 음원을 끌어다 놓거나 클릭해 선택</strong>
                  <p>MP4, WebM, MP3, WAV, M4A 등 브라우저 지원 형식을 사용할 수 있습니다.</p>
                </div>
              )}
            </div>
          )}

          {error && <div className="message-banner error" role="alert">{error}</div>}
          {notice && !error && <div className="message-banner notice">{notice}</div>}
        </section>

        <div className="workspace-grid">
          <section className="panel player-panel">
            <div className="video-stage">
              {!hasActiveSource && (
                <div className="empty-player">
                  <div className="empty-player-icon">▶</div>
                  <strong>연습할 미디어를 불러와 주세요</strong>
                  <span>YouTube 링크, 내 컴퓨터의 영상 또는 음원 파일을 사용할 수 있습니다.</span>
                </div>
              )}

              {sourceType === 'youtube' && youtubeVideoId && (
                <YouTubePlayer
                  key={youtubeVideoId}
                  ref={playerRef}
                  videoId={youtubeVideoId}
                  playbackRate={playbackRate}
                  onReady={handleReady}
                  onPlayingChange={handlePlayingChange}
                  onError={handlePlayerError}
                />
              )}

              {sourceType === 'local' && localFile && (
                <LocalMediaPlayer
                  key={localFile.url}
                  ref={playerRef}
                  src={localFile.url}
                  name={localFile.name}
                  kind={localFile.kind}
                  playbackRate={playbackRate}
                  onReady={handleReady}
                  onPlayingChange={handlePlayingChange}
                  onError={handlePlayerError}
                />
              )}
            </div>

            <div className="timeline-area">
              <div className="timeline-labels">
                <span>{formatTime(currentTime, true)}</span>
                <span>{formatTime(duration, true)}</span>
              </div>
              <div className="timeline-track-wrap">
                <div className="timeline-track" aria-hidden="true">
                  <div className="timeline-progress" style={{ width: `${progress}%` }} />
                  {loopEnabled && activeLoop.end > activeLoop.start && (
                    <div
                      className="timeline-loop"
                      style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }}
                    />
                  )}
                </div>
                <input
                  className="timeline-range"
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.01}
                  value={Math.min(currentTime, duration || 1)}
                  disabled={!isReady}
                  aria-label="재생 위치"
                  onChange={(event) => seekTo(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="transport-row">
              <div className="transport-group">
                <button type="button" className="icon-button" disabled={!isReady} onClick={() => seekBy(-5)}>
                  −5초
                </button>
                <button type="button" className="fine-button" disabled={!isReady} onClick={() => seekBy(-0.1)}>
                  −0.1
                </button>
              </div>
              <button type="button" className="play-button" disabled={!isReady} onClick={togglePlayback}>
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <div className="transport-group">
                <button type="button" className="fine-button" disabled={!isReady} onClick={() => seekBy(0.1)}>
                  +0.1
                </button>
                <button type="button" className="icon-button" disabled={!isReady} onClick={() => seekBy(5)}>
                  +5초
                </button>
              </div>
              <button
                type="button"
                className={loopEnabled ? 'loop-toggle active' : 'loop-toggle'}
                disabled={!isReady}
                onClick={() => setLoopEnabled((enabled) => !enabled)}
              >
                ↻ 반복 {loopEnabled ? 'ON' : 'OFF'}
              </button>
              <button type="button" className="loop-count" disabled={!isReady} onClick={() => setLoopCount(0)}>
                반복 {loopCount}회 · 초기화
              </button>
            </div>

            <div className="speed-section">
              <div className="section-title-row">
                <h2>재생 속도</h2>
                <strong>{playbackRate.toFixed(2)}×</strong>
              </div>
              <div className="speed-buttons">
                {SPEEDS.map((speed) => (
                  <button
                    type="button"
                    key={speed}
                    className={playbackRate === speed ? 'speed-button active' : 'speed-button'}
                    disabled={!hasActiveSource}
                    onClick={() => setSpeed(speed)}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="controls-column">
            <section className="panel settings-panel">
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">STEP 1</span>
                  <h2>마디 설정</h2>
                </div>
                <span className="subtle">설정은 자동 저장됩니다</span>
              </div>

              <div className="settings-grid">
                <div className="field">
                  <label htmlFor="bpm">BPM</label>
                  <div className="number-stepper">
                    <button type="button" onClick={() => adjustBpm(-1)} aria-label="BPM 1 감소">−</button>
                    <input
                      id="bpm"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bpmInput}
                      onChange={(event) => handleBpmChange(event.target.value)}
                      onBlur={finalizeBpm}
                      aria-describedby="bpm-help"
                    />
                    <button type="button" onClick={() => adjustBpm(1)} aria-label="BPM 1 증가">＋</button>
                  </div>
                  <span id="bpm-help" className="field-help">앞자리 0 없이 20~400</span>
                </div>
                <div className="field">
                  <label htmlFor="beats">한 마디의 박자</label>
                  <select
                    id="beats"
                    value={beatsPerBar}
                    onChange={(event) => setBeatsPerBar(Number(event.target.value))}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 12].map((value) => (
                      <option key={value} value={value}>{value}박</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="tap-tempo-row">
                <button type="button" className="secondary-button" onClick={tapTempo}>
                  탭 템포
                </button>
                <div>
                  <strong>리듬에 맞춰 클릭</strong>
                  <span>{tapCount > 0 ? `${tapCount}회 입력됨` : '2회 이상 탭하면 BPM 자동 계산'}</span>
                </div>
              </div>

              <div className="field">
                <div className="label-row">
                  <label htmlFor="downbeat">첫 다운비트</label>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!isReady}
                    onClick={() => setFirstDownbeat(currentTime)}
                  >
                    현재 위치로 설정
                  </button>
                </div>
                <div className="stepper-row">
                  <button
                    type="button"
                    disabled={!isReady}
                    onClick={() => setFirstDownbeat((value) => clamp(value - 0.05, 0, duration))}
                  >
                    −0.05
                  </button>
                  <input
                    id="downbeat"
                    type="number"
                    min={0}
                    max={duration || undefined}
                    step={0.01}
                    value={Number(firstDownbeat.toFixed(2))}
                    onChange={(event) =>
                      setFirstDownbeat(clamp(Number(event.target.value), 0, duration || 0))
                    }
                  />
                  <button
                    type="button"
                    disabled={!isReady}
                    onClick={() => setFirstDownbeat((value) => clamp(value + 0.05, 0, duration))}
                  >
                    +0.05
                  </button>
                  <button type="button" disabled={!isReady} onClick={() => seekTo(firstDownbeat)}>
                    이동
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="primary-button full-width"
                disabled={!isReady}
                onClick={generateBarSegments}
              >
                마디 나누기
              </button>
            </section>

            <section className="panel loop-panel">
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">STEP 2</span>
                  <h2>반복 구간</h2>
                </div>
                <div className="mode-tabs">
                  <button
                    type="button"
                    className={loopMode === 'bars' ? 'active' : ''}
                    onClick={() => setLoopMode('bars')}
                  >
                    마디
                  </button>
                  <button
                    type="button"
                    className={loopMode === 'time' ? 'active' : ''}
                    onClick={() => setLoopMode('time')}
                  >
                    시간
                  </button>
                </div>
              </div>

              {loopMode === 'bars' ? (
                bars.length > 0 && selectedBars ? (
                  <>
                    <div className="bar-range-controls">
                      <button type="button" onClick={() => moveBarSelection(-1)}>← 이전</button>
                      <div>
                        <strong>
                          {selectedBars.startIndex + 1}
                          {selectedBars.endIndex > selectedBars.startIndex
                            ? `–${selectedBars.endIndex + 1}`
                            : ''}
                          마디
                        </strong>
                        <span>
                          {formatTime(selectedBars.start, true)} – {formatTime(selectedBars.end, true)}
                        </span>
                      </div>
                      <button type="button" onClick={() => moveBarSelection(1)}>다음 →</button>
                    </div>

                    <div className="bar-select-row">
                      <label>
                        시작 마디
                        <select
                          value={selectedBars.startIndex}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setSelectedBarStart(next);
                            setSelectedBarEnd((end) => Math.max(end, next));
                            seekTo(bars[next].start);
                          }}
                        >
                          {bars.map((bar) => (
                            <option key={bar.index} value={bar.index}>{bar.index + 1}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        종료 마디
                        <select
                          value={selectedBars.endIndex}
                          onChange={(event) => setSelectedBarEnd(Number(event.target.value))}
                        >
                          {bars.slice(selectedBars.startIndex).map((bar) => (
                            <option key={bar.index} value={bar.index}>{bar.index + 1}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="bar-grid" aria-label="생성된 마디 목록">
                      {bars.map((bar) => {
                        const isSelected =
                          bar.index >= selectedBars.startIndex && bar.index <= selectedBars.endIndex;
                        return (
                          <button
                            type="button"
                            key={bar.index}
                            className={isSelected ? 'bar-button active' : 'bar-button'}
                            title={`${formatTime(bar.start, true)} – ${formatTime(bar.end, true)}`}
                            onClick={(event) => selectBar(bar.index, event)}
                          >
                            <strong>{bar.index + 1}</strong>
                            <span>{formatTime(bar.start)}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="hint">Shift를 누른 채 마디를 클릭하면 여러 마디를 범위로 선택합니다.</p>
                  </>
                ) : (
                  <div className="empty-control">
                    BPM과 첫 다운비트를 맞춘 뒤 <strong>마디 나누기</strong>를 눌러 주세요.
                  </div>
                )
              ) : (
                <div className="time-loop-controls">
                  <div className="time-boundary">
                    <div>
                      <span>A · 시작</span>
                      <strong>{formatTime(timeLoopStart, true)}</strong>
                    </div>
                    <div className="boundary-actions">
                      <button type="button" disabled={!isReady} onClick={() => setTimeBoundary('start', currentTime)}>
                        현재 위치
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={duration}
                        step={0.01}
                        value={Number(timeLoopStart.toFixed(2))}
                        onChange={(event) => setTimeBoundary('start', Number(event.target.value))}
                      />
                    </div>
                  </div>
                  <div className="time-boundary">
                    <div>
                      <span>B · 종료</span>
                      <strong>{formatTime(timeLoopEnd, true)}</strong>
                    </div>
                    <div className="boundary-actions">
                      <button type="button" disabled={!isReady} onClick={() => setTimeBoundary('end', currentTime)}>
                        현재 위치
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={duration}
                        step={0.01}
                        value={Number(timeLoopEnd.toFixed(2))}
                        onChange={(event) => setTimeBoundary('end', Number(event.target.value))}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="secondary-button full-width"
                    disabled={!isReady || timeLoopEnd <= timeLoopStart}
                    onClick={() => seekTo(timeLoopStart)}
                  >
                    A 지점부터 재생
                  </button>
                </div>
              )}
            </section>

            <section className="panel utility-panel">
              <div>
                <span className="eyebrow">TOOLS</span>
                <h2>연습 도구</h2>
              </div>
              <p>BPM, 박자, 속도와 반복 설정은 이 브라우저에 자동 저장됩니다.</p>
              <button type="button" className="secondary-button full-width" onClick={resetPracticeSettings}>
                연습 설정 초기화
              </button>
            </section>
          </aside>
        </div>

        <section className="shortcut-strip">
          <span><kbd>Space</kbd> 재생/정지</span>
          <span><kbd>←</kbd><kbd>→</kbd> 5초 이동</span>
          <span><kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> 0.1초 이동</span>
          <span><kbd>L</kbd> 반복 ON/OFF</span>
          <span><kbd>[</kbd> A 지점</span>
          <span><kbd>]</kbd> B 지점</span>
        </section>
      </main>

      <footer>
        <p>로컬 영상과 음원은 서버에 업로드하거나 저장하지 않습니다. 브라우저가 지원하는 코덱만 재생할 수 있습니다.</p>
      </footer>
    </div>
  );
}

export default App;
