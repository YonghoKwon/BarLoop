from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        "import LocalMediaPlayer from './components/LocalMediaPlayer';\n",
        "import LocalMediaPlayer from './components/LocalMediaPlayer';\nimport MediaPracticePanel from './components/MediaPracticePanel';\n",
    ),
    (
        "  preservePitch: boolean;\n  metronomeEnabled: boolean;",
        "  preservePitch: boolean;\n  mediaVolume: number;\n  preRollBeats: number;\n  metronomeEnabled: boolean;",
    ),
    (
        "  preservePitch: true,\n  metronomeEnabled: false,",
        "  preservePitch: true,\n  mediaVolume: 0.85,\n  preRollBeats: 4,\n  metronomeEnabled: false,",
    ),
    (
        "      preservePitch: typeof parsed.preservePitch === 'boolean' ? parsed.preservePitch : true,\n      metronomeEnabled: Boolean(parsed.metronomeEnabled),",
        "      preservePitch: typeof parsed.preservePitch === 'boolean' ? parsed.preservePitch : true,\n      mediaVolume: typeof parsed.mediaVolume === 'number' ? clamp(parsed.mediaVolume, 0, 1) : 0.85,\n      preRollBeats: clamp(Math.round(Number(parsed.preRollBeats) || 4), 0, 24),\n      metronomeEnabled: Boolean(parsed.metronomeEnabled),",
    ),
    (
        "  const [preservePitch, setPreservePitch] = useState(initialSettingsRef.current.preservePitch);\n  const [error, setError] = useState('');",
        "  const [preservePitch, setPreservePitch] = useState(initialSettingsRef.current.preservePitch);\n  const [mediaVolume, setMediaVolume] = useState(initialSettingsRef.current.mediaVolume);\n  const [preRollBeats, setPreRollBeats] = useState(initialSettingsRef.current.preRollBeats);\n  const [error, setError] = useState('');",
    ),
    (
        "    preservePitch,\n    metronomeEnabled,",
        "    preservePitch,\n    mediaVolume,\n    preRollBeats,\n    metronomeEnabled,",
    ),
    (
        "    playbackRate,\n    preservePitch,\n    subdivision,",
        "    mediaVolume,\n    playbackRate,\n    preRollBeats,\n    preservePitch,\n    subdivision,",
    ),
    (
        "  const stopTrainerTimers = useCallback(() => {",
        "  useEffect(() => {\n    playerRef.current?.setVolume(mediaVolume);\n  }, [isReady, mediaVolume]);\n\n  const stopTrainerTimers = useCallback(() => {",
    ),
    (
        "  const restartLoop = useCallback(() => seekTo(activeLoop.start), [activeLoop.start, seekTo]);\n\n  const metronomeSettings",
        "  const restartLoop = useCallback(() => seekTo(activeLoop.start), [activeLoop.start, seekTo]);\n\n  const playFromPreRoll = useCallback(async () => {\n    if (!isReady) return;\n    const secondsPerBeat = 60 / Math.max(20, Number.isFinite(bpm) ? bpm : 120);\n    seekTo(Math.max(0, activeLoop.start - preRollBeats * secondsPerBeat));\n    try {\n      await playerRef.current?.play();\n      setNotice(preRollBeats > 0 ? `${preRollBeats}박 프리롤부터 재생합니다.` : 'A 지점부터 재생합니다.');\n    } catch {\n      setError('프리롤 재생을 시작할 수 없습니다. 화면을 한 번 탭한 뒤 다시 시도해 주세요.');\n    }\n  }, [activeLoop.start, bpm, isReady, preRollBeats, seekTo]);\n\n  const applyFillPreset = useCallback((grooveBars: 3 | 7) => {\n    if (!selectedBars || bars.length === 0) {\n      setError('Fill Trainer를 사용하려면 마디를 먼저 생성해 주세요.');\n      return;\n    }\n    const nextEnd = Math.min(bars.length - 1, selectedBars.startIndex + grooveBars);\n    setLoopMode('bars');\n    setSelectedBarEnd(nextEnd);\n    seekTo(bars[selectedBars.startIndex].start);\n    setNotice(`${grooveBars}마디 그루브 + 1마디 필인 범위를 선택했습니다.`);\n  }, [bars, seekTo, selectedBars]);\n\n  const metronomeSettings",
    ),
    (
        "<YouTubePlayer key={youtubeVideoId} ref={playerRef} videoId={youtubeVideoId} playbackRate={playbackRate}",
        "<YouTubePlayer key={youtubeVideoId} ref={playerRef} videoId={youtubeVideoId} playbackRate={playbackRate} volume={mediaVolume}",
    ),
    (
        "<LocalMediaPlayer key={localFile.url} ref={playerRef} src={localFile.url} name={localFile.name} kind={localFile.kind} playbackRate={playbackRate} preservePitch={preservePitch}",
        "<LocalMediaPlayer key={localFile.url} ref={playerRef} src={localFile.url} name={localFile.name} kind={localFile.kind} playbackRate={playbackRate} preservePitch={preservePitch} volume={mediaVolume}",
    ),
    (
        "          <MetronomePanel enabled={metronomeEnabled}",
        "          <MediaPracticePanel mediaVolume={mediaVolume} onMediaVolumeChange={setMediaVolume} preRollBeats={preRollBeats} onPreRollBeatsChange={setPreRollBeats} beatsPerBar={beatsPerBar} bpm={Number.isFinite(bpm) ? bpm : 120} disabled={!isReady} canUseBars={bars.length >= 4} onPlayPreRoll={() => void playFromPreRoll()} onFillPreset={applyFillPreset} />\n          <MetronomePanel enabled={metronomeEnabled}",
    ),
    (
        "    setPreservePitch(true);\n    setMetronomeEnabled(false);",
        "    setPreservePitch(true);\n    setMediaVolume(0.85);\n    setPreRollBeats(beatsPerBar);\n    setMetronomeEnabled(false);",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:90]!r}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
