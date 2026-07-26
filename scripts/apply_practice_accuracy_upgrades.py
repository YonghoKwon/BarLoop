from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing patch target: {label}')
    return text.replace(old, new, 1)


app_path = 'src/App.tsx'
app = read(app_path)

app = replace_once(
    app,
    "import { MetronomeEngine, type MetronomeSettings, type Subdivision } from './lib/metronome';",
    """import {
  MetronomeEngine,
  type CountInClickMode,
  type MediaCountMode,
  type MetronomeSettings,
  type Subdivision,
} from './lib/metronome';
import { preparePlaybackAudioSession, releasePlaybackAudioSession } from './lib/audioPlaybackSession';
import {
  isKoreanCountVoiceSupported,
  primeKoreanCountVoice,
  speakKoreanCount,
  stopKoreanCountVoice,
} from './lib/koreanCountVoice';
import { getMediaBeatPosition } from './lib/mediaBeat';""",
    'App imports',
)

app = replace_once(
    app,
    "  metronomeVolume: number;\n  gapEnabled: boolean;",
    """  metronomeVolume: number;
  countMode: MediaCountMode;
  countInClickMode: CountInClickMode;
  syncOffsetMs: number;
  gapEnabled: boolean;""",
    'stored settings fields',
)

app = replace_once(
    app,
    "  metronomeVolume: 0.55,\n  gapEnabled: false,",
    """  metronomeVolume: 0.55,
  countMode: 'click',
  countInClickMode: 'beat',
  syncOffsetMs: 0,
  gapEnabled: false,""",
    'default settings',
)

app = replace_once(
    app,
    "      metronomeVolume: clamp(Number(parsed.metronomeVolume) || 0.55, 0.05, 1),\n      gapEnabled: Boolean(parsed.gapEnabled),",
    """      metronomeVolume: clamp(Number(parsed.metronomeVolume) || 0.55, 0.05, 1),
      countMode: ['click', 'voice', 'both'].includes(String(parsed.countMode))
        ? (String(parsed.countMode) as MediaCountMode)
        : 'click',
      countInClickMode: ['beat', 'subdivision'].includes(String(parsed.countInClickMode))
        ? (String(parsed.countInClickMode) as CountInClickMode)
        : 'beat',
      syncOffsetMs: clamp(Math.round(Number(parsed.syncOffsetMs) || 0), -200, 200),
      gapEnabled: Boolean(parsed.gapEnabled),""",
    'read stored settings',
)

app = replace_once(
    app,
    "  const tapTimesRef = useRef<number[]>([]);\n  const metronomeRef",
    """  const tapTimesRef = useRef<number[]>([]);
  const tapMediaTimesRef = useRef<number[]>([]);
  const metronomeRef""",
    'tap media ref',
)

app = replace_once(
    app,
    "  const [metronomeVolume, setMetronomeVolume] = useState(initialSettingsRef.current.metronomeVolume);\n  const [gapEnabled",
    """  const [metronomeVolume, setMetronomeVolume] = useState(initialSettingsRef.current.metronomeVolume);
  const [countMode, setCountMode] = useState<MediaCountMode>(initialSettingsRef.current.countMode);
  const [countInClickMode, setCountInClickMode] = useState<CountInClickMode>(initialSettingsRef.current.countInClickMode);
  const [syncOffsetMs, setSyncOffsetMs] = useState(initialSettingsRef.current.syncOffsetMs);
  const [gapEnabled""",
    'media metronome states',
)

app = replace_once(
    app,
    "  const bpm = Number(bpmInput);\n  const hasActiveSource",
    """  const bpm = Number(bpmInput);
  const voiceCountSupported = isKoreanCountVoiceSupported();
  const outputHasClick = countMode !== 'voice' || !voiceCountSupported;
  const outputHasVoice = countMode !== 'click' && voiceCountSupported;
  const hasActiveSource""",
    'media output capabilities',
)

app = replace_once(
    app,
    "    metronomeVolume,\n    gapEnabled,",
    """    metronomeVolume,
    countMode,
    countInClickMode,
    syncOffsetMs,
    gapEnabled,""",
    'stored settings values',
)

app = replace_once(
    app,
    "    countInBars,\n    gapEnabled,",
    """    countInBars,
    countInClickMode,
    countMode,
    gapEnabled,""",
    'stored settings dependencies 1',
)

app = replace_once(
    app,
    "    subdivision,\n  ]);",
    """    subdivision,
    syncOffsetMs,
  ]);""",
    'stored settings dependencies 2',
)

old_preroll = """  const playFromPreRoll = useCallback(async () => {
    if (!isReady) return;
    const secondsPerBeat = 60 / Math.max(20, Number.isFinite(bpm) ? bpm : 120);
    seekTo(Math.max(0, activeLoop.start - preRollBeats * secondsPerBeat));
    try {
      await playerRef.current?.play();
      setNotice(preRollBeats > 0 ? `${preRollBeats}박 프리롤부터 재생합니다.` : 'A 지점부터 재생합니다.');
    } catch {
      setError('프리롤 재생을 시작할 수 없습니다. 화면을 한 번 탭한 뒤 다시 시도해 주세요.');
    }
  }, [activeLoop.start, bpm, isReady, preRollBeats, seekTo]);"""
new_preroll = """  const playFromPreRoll = useCallback(async () => {
    if (!isReady) return;
    const secondsPerBeat = 60 / Math.max(20, Number.isFinite(bpm) ? bpm : 120);
    seekTo(Math.max(0, activeLoop.start - preRollBeats * secondsPerBeat));
    try {
      await Promise.all([
        preparePlaybackAudioSession(),
        metronomeRef.current.unlock(),
      ]);
      if (outputHasVoice) primeKoreanCountVoice();
      await playerRef.current?.play();
      setNotice(preRollBeats > 0 ? `${preRollBeats}박 프리롤부터 재생합니다.` : 'A 지점부터 재생합니다.');
    } catch {
      setError('프리롤 재생을 시작할 수 없습니다. 화면을 한 번 탭한 뒤 다시 시도해 주세요.');
    }
  }, [activeLoop.start, bpm, isReady, outputHasVoice, preRollBeats, seekTo]);"""
app = replace_once(app, old_preroll, new_preroll, 'pre-roll audio preparation')

old_settings = """  const metronomeSettings = useMemo<MetronomeSettings>(() => ({
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
  ]);"""
new_settings = """  const metronomeSettings = useMemo<MetronomeSettings>(() => ({
    bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : 120,
    beatsPerBar,
    subdivision,
    volume: metronomeVolume,
    playbackRate,
    firstDownbeat,
    syncOffsetMs,
    clickEnabled: outputHasClick,
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
    outputHasClick,
    playbackRate,
    subdivision,
    syncOffsetMs,
  ]);

  const speakCurrentBeat = useCallback((beat: number, nextSubdivisionInBeat: number, audible: boolean) => {
    if (!audible || nextSubdivisionInBeat !== 0 || !outputHasVoice) return;
    speakKoreanCount(
      beat,
      (Number.isFinite(bpm) && bpm > 0 ? bpm : 120) * playbackRate,
      metronomeVolume,
    );
  }, [bpm, metronomeVolume, outputHasVoice, playbackRate]);"""
app = replace_once(app, old_settings, new_settings, 'metronome settings and voice callback')

start = app.index('  const togglePlayback = useCallback(async () => {')
end = app.index('\n\n  const midi = useMidiControls', start)
new_toggle = """  const togglePlayback = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !isReady) return;
    if (isPlaying) {
      countInSequenceRef.current += 1;
      metronomeRef.current.stopAll();
      setCountInRemaining(null);
      stopKoreanCountVoice();
      releasePlaybackAudioSession();
      player.pause();
      return;
    }

    const sequence = countInSequenceRef.current + 1;
    countInSequenceRef.current = sequence;
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    try {
      await Promise.all([
        preparePlaybackAudioSession(),
        metronomeRef.current.unlock(),
      ]);
      if (outputHasVoice) primeKoreanCountVoice();
      if (countInBars > 0) {
        try {
          await player.play();
          player.pause();
        } catch {
          // The real playback attempt below will surface media errors.
        }
        setCountInRemaining(countInBars * beatsPerBar);
        await metronomeRef.current.countIn({
          bpm: safeBpm * playbackRate,
          beatsPerBar,
          bars: countInBars,
          volume: metronomeVolume,
          subdivision,
          clickMode: countInClickMode,
          clickEnabled: outputHasClick,
          onStep: (remaining, beat, nextSubdivisionInBeat) => {
            setCountInRemaining(remaining);
            setBeatInBar(beat);
            setSubdivisionInBeat(nextSubdivisionInBeat);
            setAudibleBeat(true);
            speakCurrentBeat(beat, nextSubdivisionInBeat, true);
          },
        });
      }
      if (countInSequenceRef.current !== sequence) return;
      setCountInRemaining(null);
      await player.play();
    } catch {
      setCountInRemaining(null);
      stopKoreanCountVoice();
      releasePlaybackAudioSession();
      setError('재생을 시작할 수 없습니다. 화면을 한 번 더 탭한 뒤 시도해 주세요.');
    }
  }, [
    beatsPerBar,
    bpm,
    countInBars,
    countInClickMode,
    isPlaying,
    isReady,
    metronomeVolume,
    outputHasClick,
    outputHasVoice,
    playbackRate,
    speakCurrentBeat,
    subdivision,
  ]);"""
app = app[:start] + new_toggle + app[end:]

old_effect = """  useEffect(() => {
    if (!isPlaying || !metronomeEnabled) {
      metronomeRef.current.stopContinuous();
      return;
    }
    void metronomeRef.current.start(
      () => playerRef.current?.getCurrentTime() ?? 0,
      metronomeSettings,
      (beat, nextSubdivisionInBeat, audible) => {
        setBeatInBar(beat);
        setSubdivisionInBeat(nextSubdivisionInBeat);
        setAudibleBeat(audible);
      },
    ).catch(() => setError('메트로놈 오디오를 시작할 수 없습니다.'));
    return () => metronomeRef.current.stopContinuous();
  }, [isPlaying, metronomeEnabled, metronomeSettings]);"""
new_effect = """  useEffect(() => {
    if (!isPlaying || !metronomeEnabled) {
      metronomeRef.current.stopContinuous();
      return;
    }
    void metronomeRef.current.start(
      () => playerRef.current?.getCurrentTime() ?? 0,
      metronomeSettings,
      (beat, nextSubdivisionInBeat, audible) => {
        setBeatInBar(beat);
        setSubdivisionInBeat(nextSubdivisionInBeat);
        setAudibleBeat(audible);
        speakCurrentBeat(beat, nextSubdivisionInBeat, audible);
      },
    ).catch(() => setError('메트로놈 오디오를 시작할 수 없습니다.'));
    return () => metronomeRef.current.stopContinuous();
  }, [isPlaying, metronomeEnabled, metronomeSettings, speakCurrentBeat]);

  useEffect(() => {
    if (!isReady || countInRemaining !== null || (isPlaying && metronomeEnabled)) return;
    const position = getMediaBeatPosition(
      currentTime,
      Number.isFinite(bpm) && bpm > 0 ? bpm : 120,
      beatsPerBar,
      subdivision,
      firstDownbeat,
      syncOffsetMs,
    );
    setBeatInBar(position.beatInBar);
    setSubdivisionInBeat(position.subdivisionInBeat);
    setAudibleBeat(true);
  }, [
    beatsPerBar,
    bpm,
    countInRemaining,
    currentTime,
    firstDownbeat,
    isPlaying,
    isReady,
    metronomeEnabled,
    subdivision,
    syncOffsetMs,
  ]);"""
app = replace_once(app, old_effect, new_effect, 'continuous and visual count effects')

app = replace_once(
    app,
    "    metronomeRef.current.stopAll();\n    stopTrainerTimers();",
    """    metronomeRef.current.stopAll();
    stopKoreanCountVoice();
    releasePlaybackAudioSession();
    stopTrainerTimers();""",
    'unmount audio cleanup',
)

app = replace_once(
    app,
    "    setCountInRemaining(null);\n    setError('');",
    """    setCountInRemaining(null);
    stopKoreanCountVoice();
    releasePlaybackAudioSession();
    setError('');""",
    'reset audio cleanup',
)

app = replace_once(
    app,
    "  const handlePlayerError = useCallback((message: string) => {\n    setError(message);",
    """  const handlePlayerError = useCallback((message: string) => {
    metronomeRef.current.stopAll();
    stopKoreanCountVoice();
    releasePlaybackAudioSession();
    setError(message);""",
    'player error cleanup',
)

old_tap = """  const tapTempo = () => {
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
  };"""
new_tap = """  const tapTempo = () => {
    const now = performance.now();
    const previous = tapTimesRef.current.at(-1);
    let times = tapTimesRef.current;
    let mediaTimes = tapMediaTimesRef.current;
    if (!previous || now - previous > 2500) {
      times = [];
      mediaTimes = [];
    }

    const mediaNow = playerRef.current?.getCurrentTime() ?? currentTime;
    times = [...times, now].slice(-8);
    mediaTimes = [...mediaTimes, mediaNow].slice(-8);
    tapTimesRef.current = times;
    tapMediaTimesRef.current = mediaTimes;
    setTapCount(times.length);

    if (times.length === 1 && isReady) {
      setFirstDownbeat(mediaNow);
      setNotice(`첫 탭 ${formatTime(mediaNow, true)}을 다운비트로 지정했습니다. 같은 박으로 계속 탭해 주세요.`);
      setError('');
      return;
    }

    if (times.length >= 2) {
      const intervals = times.slice(1).map((time, index) => time - times[index]);
      const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const tappedBpm = clamp(Math.round(60000 / average), 20, 400);
      const tappedDownbeat = mediaTimes[0] ?? mediaNow;
      setBpmInput(String(tappedBpm));
      if (isReady) setFirstDownbeat(tappedDownbeat);

      if (times.length >= 4 && isReady && duration > 0) {
        const nextBars = generateBars(duration, tappedBpm, beatsPerBar, tappedDownbeat);
        setBars(nextBars);
        setSelectedBarStart(0);
        setSelectedBarEnd(0);
        setLoopMode('bars');
        setNotice(`${times.length}회 탭으로 ${tappedBpm} BPM과 첫 박을 맞추고 ${nextBars.length}개 마디를 미리 생성했습니다.`);
      } else {
        setNotice(`${times.length}회 탭 평균으로 ${tappedBpm} BPM을 설정했습니다. 4회 이상 탭하면 마디도 미리 생성합니다.`);
      }
      setError('');
    }
  };"""
app = replace_once(app, old_tap, new_tap, 'tap tempo and downbeat helper')

app = replace_once(
    app,
    "    setMetronomeEnabled(false);\n    setCountInBars(1);\n    setSubdivision(1);",
    """    setMetronomeEnabled(false);
    setCountInBars(1);
    setSubdivision(1);
    setCountMode('click');
    setCountInClickMode('beat');
    setSyncOffsetMs(0);""",
    'reset media metronome settings',
)

app = replace_once(
    app,
    "    tapTimesRef.current = [];\n    setTapCount(0);",
    """    tapTimesRef.current = [];
    tapMediaTimesRef.current = [];
    setTapCount(0);""",
    'reset tap helper',
)

app = replace_once(
    app,
    '<div className="tap-tempo-row"><button type="button" className="secondary-button" onClick={tapTempo}>탭 템포</button><div><strong>리듬에 맞춰 탭</strong><span>{tapCount > 0 ? `${tapCount}회 입력` : \'2회 이상 탭\'}</span></div></div>',
    '<div className="tap-tempo-row"><button type="button" className="secondary-button" onClick={tapTempo}>박자 맞춤 탭</button><div><strong>첫 탭 = 첫 박</strong><span>{tapCount > 0 ? `${tapCount}회 입력 · 4회부터 마디 미리 생성` : \'영상의 첫 박부터 4회 이상 탭\'}</span></div></div>',
    'tap helper UI',
)

old_panel = '<MetronomePanel enabled={metronomeEnabled} onEnabledChange={setMetronomeEnabled} countInBars={countInBars} onCountInBarsChange={setCountInBars} subdivision={subdivision} onSubdivisionChange={setSubdivision} volume={metronomeVolume} onVolumeChange={setMetronomeVolume} gapEnabled={gapEnabled} onGapEnabledChange={setGapEnabled} gapPlayBars={gapPlayBars} gapMuteBars={gapMuteBars} onGapPlayBarsChange={(value) => setGapPlayBars(clamp(Math.round(value), 1, 16))} onGapMuteBarsChange={(value) => setGapMuteBars(clamp(Math.round(value), 1, 16))} beatInBar={beatInBar} subdivisionInBeat={subdivisionInBeat} beatsPerBar={beatsPerBar} audibleBeat={audibleBeat} countInRemaining={countInRemaining} />'
new_panel = '<MetronomePanel enabled={metronomeEnabled} onEnabledChange={setMetronomeEnabled} countInBars={countInBars} onCountInBarsChange={setCountInBars} subdivision={subdivision} onSubdivisionChange={setSubdivision} volume={metronomeVolume} onVolumeChange={setMetronomeVolume} countMode={countMode} onCountModeChange={setCountMode} countInClickMode={countInClickMode} onCountInClickModeChange={setCountInClickMode} syncOffsetMs={syncOffsetMs} onSyncOffsetMsChange={(value) => setSyncOffsetMs(clamp(Math.round(value), -200, 200))} gapEnabled={gapEnabled} onGapEnabledChange={setGapEnabled} gapPlayBars={gapPlayBars} gapMuteBars={gapMuteBars} onGapPlayBarsChange={(value) => setGapPlayBars(clamp(Math.round(value), 1, 16))} onGapMuteBarsChange={(value) => setGapMuteBars(clamp(Math.round(value), 1, 16))} beatInBar={beatInBar} subdivisionInBeat={subdivisionInBeat} beatsPerBar={beatsPerBar} audibleBeat={audibleBeat} countInRemaining={countInRemaining} />'
app = replace_once(app, old_panel, new_panel, 'MetronomePanel props')

old_overlay = 'metronomeEnabled={metronomeEnabled} audibleBeat={audibleBeat}'
new_overlay = 'metronomeEnabled={metronomeEnabled} countMode={countMode} audibleBeat={audibleBeat}'
app = replace_once(app, old_overlay, new_overlay, 'PracticeModeOverlay count mode')

write(app_path, app)

styles_path = 'src/styles.css'
styles = read(styles_path)
styles_marker = '/* Practice accuracy and media count controls. */'
if styles_marker not in styles:
    styles += """

/* Practice accuracy and media count controls. */
.media-count-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; padding: 12px; border: 1px solid #2c3342; border-radius: 12px; background: #0d1017; }
.sync-offset-control { margin-top: 12px; padding: 12px; border: 1px solid #2c3342; border-radius: 12px; background: #0d1017; }
.sync-offset-control .label-row strong { color: #ffd0c2; font-variant-numeric: tabular-nums; }
.sync-offset-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
.sync-offset-actions button { min-height: 38px; border: 1px solid #343b4b; border-radius: 8px; background: var(--surface-2); cursor: pointer; font-size: .76rem; }
@media (max-width: 560px) { .media-count-options { grid-template-columns: 1fr; } .sync-offset-actions { grid-template-columns: 1fr 1fr; } }
"""
write(styles_path, styles)

advanced_path = 'src/advanced.css'
advanced = read(advanced_path)
advanced_marker = '/* Seven-day practice chart. */'
if advanced_marker not in advanced:
    advanced += """

/* Seven-day practice chart. */
.coach-chart-section{margin:14px 0;padding:12px;border:1px solid var(--border);border-radius:14px;background:#11151e}.coach-chart-title{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:10px}.coach-chart-title span{color:#929bad;font-size:.68rem}.coach-chart{height:176px;display:grid;grid-template-columns:repeat(7,1fr);gap:7px;align-items:end}.coach-chart-day{height:100%;display:grid;grid-template-rows:20px 1fr 18px 16px;gap:3px;text-align:center;min-width:0}.coach-chart-bpm{color:#b9c1d0;font-size:.68rem;font-variant-numeric:tabular-nums}.coach-chart-track{height:100%;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:8px;background:#1b202b}.coach-chart-track i{display:block;width:72%;min-height:2px;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#9d7cff,#5b5cf0)}.coach-chart-day strong{font-size:.7rem}.coach-chart-day small{color:#929bad;font-size:.63rem}.coach-summary{grid-template-columns:repeat(3,1fr)}
@media(max-width:390px){.coach-chart{gap:4px}.coach-chart-section{padding:9px}.coach-chart-title{align-items:flex-start;flex-direction:column}.coach-summary{grid-template-columns:1fr 1fr}}
"""
write(advanced_path, advanced)

# Add Playwright to the deployment validation flow.
workflow_path = '.github/workflows/deploy-pages.yml'
workflow = read(workflow_path)
workflow = replace_once(
    workflow,
    '      - run: npm test\n      - run: npm run build\n',
    '      - run: npm test\n      - run: npm run build\n      - run: npx playwright install --with-deps chromium\n      - run: npm run test:e2e\n',
    'Playwright CI steps',
)
write(workflow_path, workflow)

# Fix the Playwright helper type without relying on the test callback signature.
e2e_path = 'e2e/practice.spec.ts'
e2e = read(e2e_path)
e2e = replace_once(
    e2e,
    "import { expect, test } from '@playwright/test';",
    "import { expect, test, type Page } from '@playwright/test';",
    'Playwright Page import',
)
e2e = replace_once(
    e2e,
    "async function loadLocalAudio(page: Parameters<typeof test>[0]['page']) {",
    'async function loadLocalAudio(page: Page) {',
    'Playwright helper page type',
)
write(e2e_path, e2e)

readme_path = 'README.md'
readme = read(readme_path)
readme = replace_once(
    readme,
    '- 0·1·2·4마디 카운트인과 Gap Click\n',
    '- 0·1·2·4마디 카운트인과 Gap Click\n- 카운트인 중에도 `1 e & a` 전체 위치 진행 및 숫자 박/모든 칸 클릭 선택\n- 메트로놈을 꺼도 미디어 시간 기준 시각 카운트 유지\n- 한국어 숫자 카운트와 클릭+음성 출력\n- 기기·블루투스 지연을 위한 ±200ms 클릭 싱크 보정\n- 첫 탭을 다운비트로 잡고 4회부터 BPM·마디를 자동 미리 생성하는 박자 맞춤 탭\n',
    'README media features',
)
readme = replace_once(
    readme,
    '- 최근 7일 세션 수·총 연습 시간·완료 수·최고 BPM\n',
    '- 최근 7일 세션 수·총 연습 시간·완료율·최고 BPM\n- 날짜별 연습 시간·최고 BPM 그래프와 연속 연습일\n',
    'README practice chart',
)
readme = replace_once(
    readme,
    'BPM 입력 정규화, Gap Click 계산, 백그라운드 복귀 시 스케줄러 재동기화, iPhone 재생 세션용 WAV 데이터와 한국어 숫자 변환을 Vitest 회귀 테스트로 검증합니다. GitHub Pages 워크플로에서도 빌드 전에 테스트를 실행합니다.',
    'BPM 입력 정규화, 미디어 박 위치·싱크 보정, Gap Click 계산, 백그라운드 복귀 시 스케줄러 재동기화, iPhone 재생 세션용 WAV 데이터와 한국어 숫자 변환을 Vitest 회귀 테스트로 검증합니다. Playwright로 데스크톱·모바일 브라우저의 카운트 표, 카운트인, 연습 화면도 확인합니다.',
    'README validation',
)
write(readme_path, readme)

sw_path = 'public/sw.js'
sw = read(sw_path)
if "barloop-shell-v9" not in sw:
    raise RuntimeError('Unexpected service worker cache version')
sw = sw.replace('barloop-shell-v9', 'barloop-shell-v10', 1)
write(sw_path, sw)
