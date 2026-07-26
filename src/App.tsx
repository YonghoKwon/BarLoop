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
import MediaPracticePanel from './components/MediaPracticePanel';
import MetronomePanel from './components/MetronomePanel';
import MidiControlPanel from './components/MidiControlPanel';
import PracticeModeOverlay from './components/PracticeModeOverlay';
import SectionPresetPanel, { type PracticeSection } from './components/SectionPresetPanel';
import TempoTrainerPanel, { type TempoTrainerSettings } from './components/TempoTrainerPanel';
import WaveformLoopEditor from './components/WaveformLoopEditor';
import YouTubePlayer from './components/YouTubePlayer';
import { useDebouncedStorage } from './hooks/useDebouncedStorage';
import { useMidiControls, type MidiMappings } from './hooks/useMidiControls';
import { usePlaybackClock } from './hooks/usePlaybackClock';
import { useWakeLock } from './hooks/useWakeLock';
import { MetronomeEngine, type MetronomeSettings, type Subdivision } from './lib/metronome';
import { readSections, writeSections } from './lib/sectionStorage';
import { clamp, extractYouTubeId, formatTime, generateBars } from './lib/time';
import { createWaveformPeaks } from './lib/waveform';
import type { BarSegment, LoopMode, PlayerHandle, SourceType } from './types';

const SPEEDS = [0.5, 0.65, 0.75, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.25, 1.5, 2];
const SETTINGS_KEY = 'barloop:practice-settings:v3';

interface StoredSettings {
  bpm: number;
  beatsPerBar: number;
  playbackRate: number;
  loopEnabled: boolean;
  preservePitch: boolean;
  mediaVolume: number;
  preRollBeats: number;
  metronomeEnabled: boolean;
  countInBars: number;
  subdivision: Subdivision;
  metronomeVolume: number;
  gapEnabled: boolean;
  gapPlayBars: number;
  gapMuteBars: number;
  midiMappings: MidiMappings;
}

interface LocalFileState {
  name: string;
  size: number;
  url: string;
  kind: 'audio' | 'video';
  mimeType: string;
  file: File;
}

const DEFAULT_MIDI_MAPPINGS: MidiMappings = {
  togglePlayback: 36,
  previous: 37,
  restart: 38,
  next: 49,
};

const DEFAULT_SETTINGS: StoredSettings = {
  bpm: 120,
  beatsPerBar: 4,
  playbackRate: 1,
  loopEnabled: true,
  preservePitch: true,
  mediaVolume: 0.85,
  preRollBeats: 4,
  metronomeEnabled: false,
  countInBars: 1,
  subdivision: 1,
  metronomeVolume: 0.55,
  gapEnabled: false,
  gapPlayBars: 4,
  gapMuteBars: 2,
  midiMappings: DEFAULT_MIDI_MAPPINGS,
};

const DEFAULT_TRAINER: TempoTrainerSettings = {
  enabled: true,
  startBpm: 80,
  targetBpm: 120,
  stepBpm: 5,
  repeatsPerStep: 4,
  restSeconds: 0,
};

function readStoredSettings(): StoredSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<StoredSettings>;
    const midiMappings = parsed.midiMappings ?? DEFAULT_MIDI_MAPPINGS;
    return {
      bpm: clamp(Math.round(Number(parsed.bpm) || DEFAULT_SETTINGS.bpm), 20, 400),
      beatsPerBar: [2, 3, 4, 5, 6, 7, 8, 12].includes(Number(parsed.beatsPerBar))
        ? Number(parsed.beatsPerBar)
        : DEFAULT_SETTINGS.beatsPerBar,
      playbackRate: SPEEDS.includes(Number(parsed.playbackRate))
        ? Number(parsed.playbackRate)
        : DEFAULT_SETTINGS.playbackRate,
      loopEnabled: typeof parsed.loopEnabled === 'boolean' ? parsed.loopEnabled : true,
      preservePitch: typeof parsed.preservePitch === 'boolean' ? parsed.preservePitch : true,
      mediaVolume: typeof parsed.mediaVolume === 'number' ? clamp(parsed.mediaVolume, 0, 1) : 0.85,
      preRollBeats: clamp(Math.round(Number(parsed.preRollBeats) || 4), 0, 24),
      metronomeEnabled: Boolean(parsed.metronomeEnabled),
      countInBars: [0, 1, 2, 4].includes(Number(parsed.countInBars)) ? Number(parsed.countInBars) : 1,
      subdivision: [1, 2, 3, 4].includes(Number(parsed.subdivision))
        ? (Number(parsed.subdivision) as Subdivision)
        : 1,
      metronomeVolume: clamp(Number(parsed.metronomeVolume) || 0.55, 0.05, 1),
      gapEnabled: Boolean(parsed.gapEnabled),
      gapPlayBars: clamp(Math.round(Number(parsed.gapPlayBars) || 4), 1, 16),
      gapMuteBars: clamp(Math.round(Number(parsed.gapMuteBars) || 2), 1, 16),
      midiMappings: {
        togglePlayback: clamp(Math.round(Number(midiMappings.togglePlayback) || 36), 0, 127),
        previous: clamp(Math.round(Number(midiMappings.previous) || 37), 0, 127),
        restart: clamp(Math.round(Number(midiMappings.restart) || 38), 0, 127),
        next: clamp(Math.round(Number(midiMappings.next) || 49), 0, 127),
      },
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
  if (extension && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus'].includes(extension)) return 'audio';
  if (extension && ['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(extension)) return 'video';
  return null;
}

function App() {
  const initialSettingsRef = useRef(readStoredSettings());
  const playerRef = useRef<PlayerHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localFileRef = useRef<LocalFileState | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const metronomeRef = useRef(new MetronomeEngine());
  const countInSequenceRef = useRef(0);
  const loopCountRef = useRef(0);
  const trainerCurrentRef = useRef<number | null>(null);
  const trainerActiveRef = useRef(false);
  const trainerSettingsRef = useRef(DEFAULT_TRAINER);
  const trainerTimerRef = useRef(0);
  const trainerIntervalRef = useRef(0);

  const [sourceType, setSourceType] = useState<SourceType>('youtube');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<LocalFileState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(initialSettingsRef.current.playbackRate);
  const [preservePitch, setPreservePitch] = useState(initialSettingsRef.current.preservePitch);
  const [mediaVolume, setMediaVolume] = useState(initialSettingsRef.current.mediaVolume);
  const [preRollBeats, setPreRollBeats] = useState(initialSettingsRef.current.preRollBeats);
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

  const [metronomeEnabled, setMetronomeEnabled] = useState(initialSettingsRef.current.metronomeEnabled);
  const [countInBars, setCountInBars] = useState(initialSettingsRef.current.countInBars);
  const [subdivision, setSubdivision] = useState<Subdivision>(initialSettingsRef.current.subdivision);
  const [metronomeVolume, setMetronomeVolume] = useState(initialSettingsRef.current.metronomeVolume);
  const [gapEnabled, setGapEnabled] = useState(initialSettingsRef.current.gapEnabled);
  const [gapPlayBars, setGapPlayBars] = useState(initialSettingsRef.current.gapPlayBars);
  const [gapMuteBars, setGapMuteBars] = useState(initialSettingsRef.current.gapMuteBars);
  const [beatInBar, setBeatInBar] = useState(0);
  const [audibleBeat, setAudibleBeat] = useState(true);
  const [countInRemaining, setCountInRemaining] = useState<number | null>(null);

  const [trainerSettings, setTrainerSettings] = useState(DEFAULT_TRAINER);
  const [trainerActive, setTrainerActive] = useState(false);
  const [trainerCurrentBpm, setTrainerCurrentBpm] = useState<number | null>(null);
  const [trainerRestRemaining, setTrainerRestRemaining] = useState(0);

  const [practiceMode, setPracticeMode] = useState(false);
  const wakeLock = useWakeLock();
  const [sections, setSections] = useState<PracticeSection[]>([]);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [waveformLoading, setWaveformLoading] = useState(false);
  const [midiMappings, setMidiMappings] = useState(initialSettingsRef.current.midiMappings);

  const bpm = Number(bpmInput);
  const hasActiveSource = sourceType === 'youtube' ? Boolean(youtubeVideoId) : Boolean(localFile);
  const mediaKey = useMemo(() => {
    if (sourceType === 'youtube' && youtubeVideoId) return `youtube:${youtubeVideoId}`;
    if (sourceType === 'local' && localFile) return `local:${localFile.name}:${localFile.size}`;
    return '';
  }, [localFile, sourceType, youtubeVideoId]);

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
    if (loopMode === 'bars' && selectedBars) return { start: selectedBars.start, end: selectedBars.end };
    return {
      start: clamp(timeLoopStart, 0, duration || Number.MAX_SAFE_INTEGER),
      end: clamp(timeLoopEnd, 0, duration || Number.MAX_SAFE_INTEGER),
    };
  }, [duration, loopMode, selectedBars, timeLoopEnd, timeLoopStart]);

  const visibleBars = useMemo(() => {
    if (bars.length <= 60) return bars;
    const center = selectedBars?.startIndex ?? 0;
    const start = Math.max(0, center - 24);
    return bars.slice(start, Math.min(bars.length, start + 49));
  }, [bars, selectedBars?.startIndex]);

  const storedSettings = useMemo<StoredSettings>(() => ({
    bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : DEFAULT_SETTINGS.bpm,
    beatsPerBar,
    playbackRate,
    loopEnabled,
    preservePitch,
    mediaVolume,
    preRollBeats,
    metronomeEnabled,
    countInBars,
    subdivision,
    metronomeVolume,
    gapEnabled,
    gapPlayBars,
    gapMuteBars,
    midiMappings,
  }), [
    beatsPerBar,
    bpm,
    countInBars,
    gapEnabled,
    gapMuteBars,
    gapPlayBars,
    loopEnabled,
    metronomeEnabled,
    metronomeVolume,
    midiMappings,
    mediaVolume,
    playbackRate,
    preRollBeats,
    preservePitch,
    subdivision,
  ]);
  useDebouncedStorage(SETTINGS_KEY, storedSettings);

  const applySpeed = useCallback((rate: number) => {
    const safeRate = clamp(rate, 0.5, 2);
    setPlaybackRate(safeRate);
    playerRef.current?.setPlaybackRate(safeRate);
  }, []);

  useEffect(() => {
    playerRef.current?.setVolume(mediaVolume);
  }, [isReady, mediaVolume]);

  const stopTrainerTimers = useCallback(() => {
    window.clearTimeout(trainerTimerRef.current);
    window.clearInterval(trainerIntervalRef.current);
    trainerTimerRef.current = 0;
    trainerIntervalRef.current = 0;
    setTrainerRestRemaining(0);
  }, []);

  const handleLoop = useCallback(() => {
    metronomeRef.current.resync();
    const nextLoopCount = loopCountRef.current + 1;
    loopCountRef.current = nextLoopCount;
    setLoopCount(nextLoopCount);

    if (!trainerActiveRef.current || !trainerSettingsRef.current.enabled) return;
    const trainer = trainerSettingsRef.current;
    if (nextLoopCount % Math.max(1, trainer.repeatsPerStep) !== 0) return;

    const current = trainerCurrentRef.current ?? trainer.startBpm;
    const direction = trainer.targetBpm >= trainer.startBpm ? 1 : -1;
    if (current === trainer.targetBpm) {
      trainerActiveRef.current = false;
      setTrainerActive(false);
      setNotice(`목표 ${trainer.targetBpm} BPM에 도달했습니다.`);
      return;
    }

    const next = direction > 0
      ? Math.min(trainer.targetBpm, current + Math.max(1, trainer.stepBpm))
      : Math.max(trainer.targetBpm, current - Math.max(1, trainer.stepBpm));
    trainerCurrentRef.current = next;
    setTrainerCurrentBpm(next);

    const resumeAtNextTempo = () => {
      applySpeed(next / Math.max(1, bpm));
      playerRef.current?.seekTo(activeLoop.start);
      void playerRef.current?.play();
      metronomeRef.current.resync();
      setNotice(`템포를 ${next} BPM으로 변경했습니다.`);
    };

    stopTrainerTimers();
    if (trainer.restSeconds > 0) {
      playerRef.current?.pause();
      setTrainerRestRemaining(trainer.restSeconds);
      trainerIntervalRef.current = window.setInterval(() => {
        setTrainerRestRemaining((remaining) => Math.max(0, remaining - 1));
      }, 1000);
      trainerTimerRef.current = window.setTimeout(() => {
        stopTrainerTimers();
        resumeAtNextTempo();
      }, trainer.restSeconds * 1000);
    } else {
      resumeAtNextTempo();
    }
  }, [activeLoop.start, applySpeed, bpm, stopTrainerTimers]);

  const { currentTime, setDisplayedTime } = usePlaybackClock({
    playerRef,
    isReady,
    isPlaying,
    loopEnabled,
    loopStart: activeLoop.start,
    loopEnd: activeLoop.end,
    onLoop: handleLoop,
  });

  const seekTo = useCallback((seconds: number) => {
    const safeTime = clamp(seconds, 0, duration || 0);
    playerRef.current?.seekTo(safeTime);
    setDisplayedTime(safeTime);
    metronomeRef.current.resync();
  }, [duration, setDisplayedTime]);

  const moveBarSelection = useCallback((direction: -1 | 1) => {
    if (!selectedBars || bars.length === 0) return;
    const selectionLength = selectedBars.endIndex - selectedBars.startIndex;
    const maxStart = Math.max(0, bars.length - selectionLength - 1);
    const nextStart = Math.floor(clamp(selectedBars.startIndex + direction, 0, maxStart));
    const nextEnd = nextStart + selectionLength;
    setSelectedBarStart(nextStart);
    setSelectedBarEnd(nextEnd);
    setLoopMode('bars');
    seekTo(bars[nextStart].start);
  }, [bars, seekTo, selectedBars]);

  const restartLoop = useCallback(() => seekTo(activeLoop.start), [activeLoop.start, seekTo]);

  const playFromPreRoll = useCallback(async () => {
    if (!isReady) return;
    const secondsPerBeat = 60 / Math.max(20, Number.isFinite(bpm) ? bpm : 120);
    seekTo(Math.max(0, activeLoop.start - preRollBeats * secondsPerBeat));
    try {
      await playerRef.current?.play();
      setNotice(preRollBeats > 0 ? `${preRollBeats}박 프리롤부터 재생합니다.` : 'A 지점부터 재생합니다.');
    } catch {
      setError('프리롤 재생을 시작할 수 없습니다. 화면을 한 번 탭한 뒤 다시 시도해 주세요.');
    }
  }, [activeLoop.start, bpm, isReady, preRollBeats, seekTo]);

  const applyFillPreset = useCallback((grooveBars: 3 | 7) => {
    if (!selectedBars || bars.length === 0) {
      setError('Fill Trainer를 사용하려면 마디를 먼저 생성해 주세요.');
      return;
    }
    const nextEnd = Math.min(bars.length - 1, selectedBars.startIndex + grooveBars);
    setLoopMode('bars');
    setSelectedBarEnd(nextEnd);
    seekTo(bars[selectedBars.startIndex].start);
    setNotice(`${grooveBars}마디 그루브 + 1마디 필인 범위를 선택했습니다.`);
  }, [bars, seekTo, selectedBars]);

  const metronomeSettings = useMemo<MetronomeSettings>(() => ({
    bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : 120,
    beatsPerBar,
    subdivision,
    volume: metronomeVolume,
    playbackRate,
    firstDownbeat,
    gapEnabled,
    gapPlayBars,
    gapMuteBars,
  }), [
    beatsPerBar,
    bpm,
    firstDownbeat,
    gapEnabled,
    gapMuteBars,
    gapPlayBars,
    metronomeVolume,
    playbackRate,
    subdivision,
  ]);

  const togglePlayback = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !isReady) return;
    if (isPlaying) {
      countInSequenceRef.current += 1;
      metronomeRef.current.cancelCountIn();
      setCountInRemaining(null);
      player.pause();
      return;
    }

    const sequence = countInSequenceRef.current + 1;
    countInSequenceRef.current = sequence;
    try {
      await metronomeRef.current.unlock();
      if (countInBars > 0) {
        try {
          await player.play();
          player.pause();
        } catch {
          // The real playback attempt below will surface media errors.
        }
        setCountInRemaining(countInBars * beatsPerBar);
        await metronomeRef.current.countIn({
          bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : 120,
          beatsPerBar,
          bars: countInBars,
          volume: metronomeVolume,
          onBeat: (remaining, beat) => {
            setCountInRemaining(remaining);
            setBeatInBar(beat);
            setAudibleBeat(true);
          },
        });
      }
      if (countInSequenceRef.current !== sequence) return;
      setCountInRemaining(null);
      await player.play();
    } catch {
      setCountInRemaining(null);
      setError('재생을 시작할 수 없습니다. 화면을 한 번 더 탭한 뒤 시도해 주세요.');
    }
  }, [beatsPerBar, bpm, countInBars, isPlaying, isReady, metronomeVolume]);

  const midi = useMidiControls(midiMappings, {
    onTogglePlayback: () => void togglePlayback(),
    onPrevious: () => moveBarSelection(-1),
    onRestart: restartLoop,
    onNext: () => moveBarSelection(1),
  });

  useEffect(() => {
    trainerActiveRef.current = trainerActive;
    trainerCurrentRef.current = trainerCurrentBpm;
    trainerSettingsRef.current = trainerSettings;
  }, [trainerActive, trainerCurrentBpm, trainerSettings]);

  useEffect(() => {
    if (!isPlaying || !metronomeEnabled) {
      metronomeRef.current.stopContinuous();
      return;
    }
    void metronomeRef.current.start(
      () => playerRef.current?.getCurrentTime() ?? 0,
      metronomeSettings,
      (beat, audible) => {
        setBeatInBar(beat);
        setAudibleBeat(audible);
      },
    ).catch(() => setError('메트로놈 오디오를 시작할 수 없습니다.'));
    return () => metronomeRef.current.stopContinuous();
  }, [isPlaying, metronomeEnabled, metronomeSettings]);

  useEffect(() => {
    metronomeRef.current.update(metronomeSettings);
  }, [metronomeSettings]);

  useEffect(() => {
    localFileRef.current = localFile;
  }, [localFile]);

  useEffect(() => () => {
    if (localFileRef.current) URL.revokeObjectURL(localFileRef.current.url);
    metronomeRef.current.stopAll();
    stopTrainerTimers();
  }, [stopTrainerTimers]);

  useEffect(() => {
    setLoopCount(0);
    loopCountRef.current = 0;
  }, [activeLoop.end, activeLoop.start, loopMode]);

  useEffect(() => {
    setSections(readSections(mediaKey));
  }, [mediaKey]);

  useEffect(() => {
    writeSections(mediaKey, sections);
  }, [mediaKey, sections]);

  useEffect(() => {
    let cancelled = false;
    setWaveformPeaks(null);
    if (!localFile || localFile.kind !== 'audio') return;
    setWaveformLoading(true);
    void createWaveformPeaks(localFile.file)
      .then((peaks) => {
        if (!cancelled) setWaveformPeaks(peaks);
      })
      .catch(() => {
        if (!cancelled) setNotice('파형은 만들지 못했지만 음원 재생과 반복은 사용할 수 있습니다.');
      })
      .finally(() => {
        if (!cancelled) setWaveformLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [localFile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, button')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlayback();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seekTo(currentTime + (event.shiftKey ? -0.1 : -5));
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        seekTo(currentTime + (event.shiftKey ? 0.1 : 5));
      } else if (event.key.toLowerCase() === 'l') {
        setLoopEnabled((enabled) => !enabled);
      } else if (event.key === '[') {
        setLoopMode('time');
        setTimeLoopStart(currentTime);
      } else if (event.key === ']') {
        setLoopMode('time');
        setTimeLoopEnd(currentTime);
      } else if (event.key.toLowerCase() === 'r') {
        restartLoop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTime, restartLoop, seekTo, togglePlayback]);

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const resetPlaybackState = useCallback(() => {
    countInSequenceRef.current += 1;
    metronomeRef.current.stopAll();
    playerRef.current?.pause();
    setIsReady(false);
    setIsPlaying(false);
    setDisplayedTime(0);
    setDuration(0);
    setBars([]);
    setSelectedBarStart(0);
    setSelectedBarEnd(0);
    setTimeLoopStart(0);
    setTimeLoopEnd(8);
    setLoopCount(0);
    loopCountRef.current = 0;
    setCountInRemaining(null);
    setError('');
    setNotice('');
    setTrainerActive(false);
    setTrainerCurrentBpm(null);
  }, [setDisplayedTime]);

  const switchSource = (nextSource: SourceType) => {
    if (sourceType === nextSource) return;
    resetPlaybackState();
    setSourceType(nextSource);
  };

  const handleReady = useCallback((nextDuration: number) => {
    const safeDuration = Number.isFinite(nextDuration) ? nextDuration : 0;
    setDuration(safeDuration);
    setDisplayedTime(0);
    setTimeLoopStart(0);
    setTimeLoopEnd(Math.min(8, safeDuration));
    setFirstDownbeat(0);
    setBars([]);
    setLoopCount(0);
    loopCountRef.current = 0;
    setIsReady(true);
    setError('');
    setNotice('미디어를 불러왔습니다. 첫 박자를 맞춘 뒤 마디를 나눠 보세요.');
  }, [setDisplayedTime]);

  const handlePlayerError = useCallback((message: string) => {
    setError(message);
    setNotice('');
    setIsReady(false);
    setIsPlaying(false);
  }, []);

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
      file,
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
      const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const tappedBpm = clamp(Math.round(60000 / average), 20, 400);
      setBpmInput(String(tappedBpm));
      setNotice(`${times.length}회 탭 평균으로 ${tappedBpm} BPM을 설정했습니다.`);
      setError('');
    } else {
      setNotice('리듬에 맞춰 두 번 이상 탭해 주세요.');
    }
  };

  const generateBarSegments = () => {
    if (!isReady || duration <= 0) {
      setError('영상 또는 음원을 먼저 불러와 주세요.');
      return;
    }
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) {
      setError('BPM은 20~400 사이로 입력해 주세요.');
      return;
    }
    const nextBars = generateBars(duration, bpm, beatsPerBar, firstDownbeat);
    setBars(nextBars);
    setSelectedBarStart(0);
    setSelectedBarEnd(0);
    setLoopMode('bars');
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

  const setTimeBoundary = (boundary: 'start' | 'end', value: number) => {
    const safe = clamp(value, 0, duration);
    setLoopMode('time');
    if (boundary === 'start') setTimeLoopStart(Math.min(safe, timeLoopEnd - 0.04));
    else setTimeLoopEnd(Math.max(safe, timeLoopStart + 0.04));
  };

  const startTrainer = () => {
    if (!isReady || activeLoop.end <= activeLoop.start) {
      setError('템포 트레이너를 시작하려면 반복 구간을 먼저 설정해 주세요.');
      return;
    }
    const start = clamp(Math.round(trainerSettings.startBpm), 20, 400);
    trainerCurrentRef.current = start;
    trainerActiveRef.current = true;
    setTrainerCurrentBpm(start);
    setTrainerActive(true);
    setLoopCount(0);
    loopCountRef.current = 0;
    applySpeed(start / Math.max(1, bpm));
    seekTo(activeLoop.start);
    setNotice(`${start} BPM에서 템포 트레이너를 시작했습니다.`);
  };

  const stopTrainer = () => {
    trainerActiveRef.current = false;
    setTrainerActive(false);
    stopTrainerTimers();
    setNotice('템포 트레이너를 중지했습니다.');
  };

  const enterPracticeMode = async () => {
    setPracticeMode(true);
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch {
      // iPhone Safari can use the in-page overlay even without Fullscreen API.
    }
    await wakeLock.request();
  };

  const closePracticeMode = async () => {
    setPracticeMode(false);
    if (document.fullscreenElement) await document.exitFullscreen?.();
    await wakeLock.release();
  };

  const loadSection = (section: PracticeSection) => {
    setLoopMode('time');
    setTimeLoopStart(clamp(section.start, 0, duration));
    setTimeLoopEnd(clamp(section.end, 0, duration));
    setBpmInput(String(section.bpm));
    applySpeed(section.playbackRate);
    seekTo(section.start);
    setNotice(`“${section.name}” 구간을 불러왔습니다.`);
  };

  const resetPracticeSettings = () => {
    setBpmInput(String(DEFAULT_SETTINGS.bpm));
    setBeatsPerBar(DEFAULT_SETTINGS.beatsPerBar);
    applySpeed(DEFAULT_SETTINGS.playbackRate);
    setLoopEnabled(true);
    setPreservePitch(true);
    setMediaVolume(0.85);
    setPreRollBeats(beatsPerBar);
    setMetronomeEnabled(false);
    setCountInBars(1);
    setSubdivision(1);
    setGapEnabled(false);
    setFirstDownbeat(0);
    setBars([]);
    setTimeLoopStart(0);
    setTimeLoopEnd(Math.min(8, duration || 8));
    setLoopCount(0);
    loopCountRef.current = 0;
    tapTimesRef.current = [];
    setTapCount(0);
    stopTrainer();
    setError('');
    setNotice('연습 설정을 기본값으로 초기화했습니다.');
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loopLeft = duration > 0 ? (activeLoop.start / duration) * 100 : 0;
  const loopWidth = duration > 0 ? Math.max(0, ((activeLoop.end - activeLoop.start) / duration) * 100) : 0;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <div className="brand-row"><span className="brand-mark">B</span><h1>BarLoop</h1></div>
          <p>드러머를 위한 브라우저 기반 구간 반복·템포 연습 도구</p>
        </div>
        <div className="header-actions">
          <div className="privacy-badge">🔒 로컬 파일은 기기 안에서만 처리</div>
          <button type="button" className="primary-button practice-mode-button" disabled={!isReady} onClick={() => void enterPracticeMode()}>
            연습 화면
          </button>
        </div>
      </header>

      <main>
        <section className="panel source-panel">
          <div className="source-tabs" role="tablist" aria-label="미디어 소스">
            <button type="button" className={sourceType === 'youtube' ? 'source-tab active' : 'source-tab'} onClick={() => switchSource('youtube')}>YouTube</button>
            <button type="button" className={sourceType === 'local' ? 'source-tab active' : 'source-tab'} onClick={() => switchSource('local')}>내 영상·음원</button>
          </div>
          {sourceType === 'youtube' ? (
            <div className="source-form">
              <div className="field grow">
                <label htmlFor="youtube-url">YouTube URL 또는 영상 ID</label>
                <input id="youtube-url" value={youtubeInput} placeholder="https://www.youtube.com/watch?v=..." onChange={(event) => setYoutubeInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') loadYouTubeVideo(); }} />
              </div>
              <button type="button" className="primary-button load-button" onClick={loadYouTubeVideo}>불러오기</button>
            </div>
          ) : (
            <div className={isDragging ? 'drop-zone dragging' : 'drop-zone'} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click(); }}>
              <input ref={fileInputRef} className="visually-hidden" type="file" accept="video/*,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.mp4,.webm,.mov,.m4v" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadLocalFile(file); event.currentTarget.value = ''; }} />
              <span className="drop-icon">＋</span>
              {localFile ? <div><div className="file-title-row"><strong>{localFile.name}</strong><span className="media-kind-badge">{localFile.kind === 'audio' ? '음원' : '영상'}</span></div><p>{formatBytes(localFile.size)} · 탭하여 다른 파일 선택</p></div> : <div><strong>영상이나 음원을 선택</strong><p>휴대폰·태블릿의 파일 앱에서도 선택할 수 있습니다.</p></div>}
            </div>
          )}
          {error && <div className="message-banner error" role="alert">{error}</div>}
          {notice && !error && <div className="message-banner notice">{notice}</div>}
          {trainerRestRemaining > 0 && <div className="message-banner notice">다음 템포까지 휴식 {trainerRestRemaining}초</div>}
        </section>

        <div className="workspace-grid">
          <section className="panel player-panel">
            <div className="video-stage">
              {!hasActiveSource && <div className="empty-player"><div className="empty-player-icon">▶</div><strong>연습할 미디어를 불러와 주세요</strong><span>YouTube, 휴대폰 파일, 태블릿 파일을 사용할 수 있습니다.</span></div>}
              {sourceType === 'youtube' && youtubeVideoId && <YouTubePlayer key={youtubeVideoId} ref={playerRef} videoId={youtubeVideoId} playbackRate={playbackRate} volume={mediaVolume} onReady={handleReady} onPlayingChange={setIsPlaying} onError={handlePlayerError} />}
              {sourceType === 'local' && localFile && <LocalMediaPlayer key={localFile.url} ref={playerRef} src={localFile.url} name={localFile.name} kind={localFile.kind} playbackRate={playbackRate} preservePitch={preservePitch} volume={mediaVolume} onReady={handleReady} onPlayingChange={setIsPlaying} onError={handlePlayerError} />}
            </div>

            <WaveformLoopEditor peaks={waveformPeaks} duration={duration} currentTime={currentTime} loopStart={activeLoop.start} loopEnd={activeLoop.end} disabled={!isReady} onSeek={seekTo} onLoopChange={(start, end) => { setLoopMode('time'); setTimeLoopStart(start); setTimeLoopEnd(end); }} />
            {waveformLoading && <p className="waveform-loading">음원 파형 생성 중…</p>}

            <div className="timeline-area">
              <div className="timeline-labels"><span>{formatTime(currentTime, true)}</span><span>{formatTime(duration, true)}</span></div>
              <div className="timeline-track-wrap">
                <div className="timeline-track"><div className="timeline-progress" style={{ width: `${progress}%` }} />{loopEnabled && activeLoop.end > activeLoop.start && <div className="timeline-loop" style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }} />}</div>
                <input className="timeline-range" type="range" min={0} max={duration || 1} step={0.01} value={Math.min(currentTime, duration || 1)} disabled={!isReady} aria-label="재생 위치" onChange={(event) => seekTo(Number(event.target.value))} />
              </div>
            </div>

            <div className="transport-row sticky-mobile-controls">
              <button type="button" className="icon-button" disabled={!isReady} onClick={() => seekTo(currentTime - 5)}>−5초</button>
              <button type="button" className="fine-button" disabled={!isReady} onClick={() => seekTo(currentTime - 0.1)}>−0.1</button>
              <button type="button" className="play-button" disabled={!isReady} onClick={() => void togglePlayback()}>{isPlaying ? '❚❚' : '▶'}</button>
              <button type="button" className="fine-button" disabled={!isReady} onClick={() => seekTo(currentTime + 0.1)}>+0.1</button>
              <button type="button" className="icon-button" disabled={!isReady} onClick={() => seekTo(currentTime + 5)}>+5초</button>
              <button type="button" className={loopEnabled ? 'loop-toggle active' : 'loop-toggle'} disabled={!isReady} onClick={() => setLoopEnabled((enabled) => !enabled)}>↻ {loopEnabled ? 'ON' : 'OFF'}</button>
              <button type="button" className="loop-count" disabled={!isReady} onClick={() => { setLoopCount(0); loopCountRef.current = 0; }}>반복 {loopCount}회</button>
            </div>

            <div className="speed-section">
              <div className="section-title-row"><h2>재생 속도</h2><strong>{Math.round(playbackRate * 100)}%</strong></div>
              <div className="speed-buttons">{SPEEDS.map((speed) => <button type="button" key={speed} className={playbackRate === speed ? 'speed-button active' : 'speed-button'} disabled={!hasActiveSource} onClick={() => applySpeed(speed)}>{Math.round(speed * 100)}%</button>)}</div>
              <label className="pitch-toggle"><input type="checkbox" checked={preservePitch} onChange={(event) => setPreservePitch(event.target.checked)} /><span>배속을 바꿔도 원래 음정 유지</span></label>
            </div>
          </section>

          <aside className="controls-column">
            <section className="panel settings-panel">
              <div className="section-title-row"><div><span className="eyebrow">STEP 1</span><h2>마디 설정</h2></div><span className="subtle">자동 저장</span></div>
              <div className="settings-grid">
                <div className="field"><label htmlFor="bpm">원곡 BPM</label><div className="number-stepper"><button type="button" onClick={() => setBpmInput(String(clamp((Number(bpmInput) || 120) - 1, 20, 400)))}>−</button><input id="bpm" type="text" inputMode="numeric" pattern="[0-9]*" value={bpmInput} onChange={(event) => { setBpmInput(normalizeBpmInput(event.target.value)); clearMessages(); }} onBlur={() => setBpmInput(String(clamp(Math.round(Number(bpmInput) || 120), 20, 400)))} /><button type="button" onClick={() => setBpmInput(String(clamp((Number(bpmInput) || 120) + 1, 20, 400)))}>＋</button></div></div>
                <div className="field"><label htmlFor="beats">한 마디 박자</label><select id="beats" value={beatsPerBar} onChange={(event) => setBeatsPerBar(Number(event.target.value))}>{[2, 3, 4, 5, 6, 7, 8, 12].map((value) => <option key={value} value={value}>{value}박</option>)}</select></div>
              </div>
              <div className="tap-tempo-row"><button type="button" className="secondary-button" onClick={tapTempo}>탭 템포</button><div><strong>리듬에 맞춰 탭</strong><span>{tapCount > 0 ? `${tapCount}회 입력` : '2회 이상 탭'}</span></div></div>
              <div className="field"><div className="label-row"><label htmlFor="downbeat">첫 다운비트</label><button type="button" className="text-button" disabled={!isReady} onClick={() => setFirstDownbeat(currentTime)}>현재 위치</button></div><div className="stepper-row"><button type="button" disabled={!isReady} onClick={() => setFirstDownbeat((value) => clamp(value - 0.05, 0, duration))}>−0.05</button><input id="downbeat" type="number" min={0} max={duration || undefined} step={0.01} value={Number(firstDownbeat.toFixed(2))} onChange={(event) => setFirstDownbeat(clamp(Number(event.target.value), 0, duration || 0))} /><button type="button" disabled={!isReady} onClick={() => setFirstDownbeat((value) => clamp(value + 0.05, 0, duration))}>+0.05</button><button type="button" disabled={!isReady} onClick={() => seekTo(firstDownbeat)}>이동</button></div></div>
              <button type="button" className="primary-button full-width" disabled={!isReady} onClick={generateBarSegments}>마디 나누기</button>
            </section>

            <section className="panel loop-panel">
              <div className="section-title-row"><div><span className="eyebrow">STEP 2</span><h2>반복 구간</h2></div><div className="mode-tabs"><button type="button" className={loopMode === 'bars' ? 'active' : ''} onClick={() => setLoopMode('bars')}>마디</button><button type="button" className={loopMode === 'time' ? 'active' : ''} onClick={() => setLoopMode('time')}>시간</button></div></div>
              {loopMode === 'bars' ? bars.length > 0 && selectedBars ? <><div className="bar-range-controls"><button type="button" onClick={() => moveBarSelection(-1)}>← 이전</button><div><strong>{selectedBars.startIndex + 1}{selectedBars.endIndex > selectedBars.startIndex ? `–${selectedBars.endIndex + 1}` : ''}마디</strong><span>{formatTime(selectedBars.start, true)}–{formatTime(selectedBars.end, true)}</span></div><button type="button" onClick={() => moveBarSelection(1)}>다음 →</button></div><div className="bar-select-row"><label>시작<select value={selectedBars.startIndex} onChange={(event) => { const next = Number(event.target.value); setSelectedBarStart(next); setSelectedBarEnd((end) => Math.max(end, next)); seekTo(bars[next].start); }}>{bars.map((bar) => <option key={bar.index} value={bar.index}>{bar.index + 1}</option>)}</select></label><label>종료<select value={selectedBars.endIndex} onChange={(event) => setSelectedBarEnd(Number(event.target.value))}>{bars.slice(selectedBars.startIndex).map((bar) => <option key={bar.index} value={bar.index}>{bar.index + 1}</option>)}</select></label></div><div className="bar-grid">{visibleBars.map((bar) => { const active = bar.index >= selectedBars.startIndex && bar.index <= selectedBars.endIndex; return <button type="button" key={bar.index} className={active ? 'bar-button active' : 'bar-button'} onClick={(event) => selectBar(bar.index, event)}><strong>{bar.index + 1}</strong><span>{formatTime(bar.start)}</span></button>; })}</div>{visibleBars.length < bars.length && <p className="hint">성능을 위해 선택 구간 주변 마디만 표시합니다. 시작·종료 선택창에는 전체 마디가 있습니다.</p>}</> : <div className="empty-control">BPM과 첫 다운비트를 맞춘 뒤 마디를 나눠 주세요.</div> : <div className="time-loop-controls"><div className="time-boundary"><div><span>A · 시작</span><strong>{formatTime(timeLoopStart, true)}</strong></div><div className="boundary-actions"><button type="button" disabled={!isReady} onClick={() => setTimeBoundary('start', currentTime)}>현재 위치</button><input type="number" min={0} max={duration} step={0.01} value={Number(timeLoopStart.toFixed(2))} onChange={(event) => setTimeBoundary('start', Number(event.target.value))} /></div></div><div className="time-boundary"><div><span>B · 종료</span><strong>{formatTime(timeLoopEnd, true)}</strong></div><div className="boundary-actions"><button type="button" disabled={!isReady} onClick={() => setTimeBoundary('end', currentTime)}>현재 위치</button><input type="number" min={0} max={duration} step={0.01} value={Number(timeLoopEnd.toFixed(2))} onChange={(event) => setTimeBoundary('end', Number(event.target.value))} /></div></div><button type="button" className="secondary-button full-width" disabled={!isReady} onClick={restartLoop}>A 지점부터</button></div>}
            </section>
          </aside>
        </div>

        <div className="tools-grid">
          <MediaPracticePanel mediaVolume={mediaVolume} onMediaVolumeChange={setMediaVolume} preRollBeats={preRollBeats} onPreRollBeatsChange={setPreRollBeats} beatsPerBar={beatsPerBar} bpm={Number.isFinite(bpm) ? bpm : 120} disabled={!isReady} canUseBars={bars.length >= 4} onPlayPreRoll={() => void playFromPreRoll()} onFillPreset={applyFillPreset} />
          <MetronomePanel enabled={metronomeEnabled} onEnabledChange={setMetronomeEnabled} countInBars={countInBars} onCountInBarsChange={setCountInBars} subdivision={subdivision} onSubdivisionChange={setSubdivision} volume={metronomeVolume} onVolumeChange={setMetronomeVolume} gapEnabled={gapEnabled} onGapEnabledChange={setGapEnabled} gapPlayBars={gapPlayBars} gapMuteBars={gapMuteBars} onGapPlayBarsChange={(value) => setGapPlayBars(clamp(Math.round(value), 1, 16))} onGapMuteBarsChange={(value) => setGapMuteBars(clamp(Math.round(value), 1, 16))} beatInBar={beatInBar} beatsPerBar={beatsPerBar} audibleBeat={audibleBeat} countInRemaining={countInRemaining} />
          <TempoTrainerPanel settings={trainerSettings} currentBpm={trainerCurrentBpm} baseBpm={Number.isFinite(bpm) ? bpm : 120} active={trainerActive} onChange={setTrainerSettings} onStart={startTrainer} onStop={stopTrainer} />
          <SectionPresetPanel mediaKey={mediaKey} sections={sections} currentStart={activeLoop.start} currentEnd={activeLoop.end} bpm={Number.isFinite(bpm) ? bpm : 120} playbackRate={playbackRate} disabled={!isReady} onSectionsChange={setSections} onLoad={loadSection} onNotice={(message) => { setNotice(message); setError(''); }} onError={(message) => { setError(message); setNotice(''); }} />
          <MidiControlPanel supported={midi.supported} enabled={midi.enabled} connectedInputs={midi.connectedInputs} lastNote={midi.lastNote} error={midi.error} mappings={midiMappings} onMappingsChange={setMidiMappings} onEnable={() => void midi.enable()} onDisable={midi.disable} />
          <section className="panel tool-panel utility-panel"><div><span className="eyebrow">TOOLS</span><h2>기본 설정</h2></div><p>회원가입·서버·DB 없이 현재 브라우저에만 설정과 구간을 저장합니다.</p><button type="button" className="secondary-button full-width" onClick={resetPracticeSettings}>연습 설정 초기화</button></section>
        </div>

        <section className="shortcut-strip"><span><kbd>Space</kbd> 재생/정지</span><span><kbd>←</kbd><kbd>→</kbd> 5초</span><span><kbd>Shift</kbd>+<kbd>←</kbd><kbd>→</kbd> 0.1초</span><span><kbd>R</kbd> 구간 처음</span><span><kbd>L</kbd> 반복</span><span><kbd>[</kbd>/<kbd>]</kbd> A/B</span></section>
      </main>

      <footer><p>로컬 파일과 연습 데이터는 서버로 전송되지 않습니다. 브라우저 호환 코덱과 기기 성능에 따라 동작이 달라질 수 있습니다.</p></footer>

      <PracticeModeOverlay visible={practiceMode} isPlaying={isPlaying} bpm={Number.isFinite(bpm) ? bpm : 120} playbackRate={playbackRate} currentTime={currentTime} loopStart={activeLoop.start} loopEnd={activeLoop.end} loopCount={loopCount} currentBeat={beatInBar} beatsPerBar={beatsPerBar} metronomeEnabled={metronomeEnabled} wakeLockActive={wakeLock.active} onClose={() => void closePracticeMode()} onTogglePlayback={() => void togglePlayback()} onPrevious={() => moveBarSelection(-1)} onRestart={restartLoop} onNext={() => moveBarSelection(1)} onToggleWakeLock={() => { if (wakeLock.active) void wakeLock.release(); else void wakeLock.request(); }} />
    </div>
  );
}

export default App;
