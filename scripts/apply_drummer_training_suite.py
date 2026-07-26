from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Expected block not found: {label}')
    return text.replace(old, new, 1)


# Extend the standalone Web Audio scheduler with groove voices and moving accents.
engine_path = Path('src/lib/standaloneMetronome.ts')
engine = engine_path.read_text(encoding='utf-8')
engine = replace_once(
    engine,
    "export type MetronomeSound = 'classic' | 'wood' | 'rim' | 'cowbell';\n",
    "import type { DrumInstrument, DrumPattern } from './drummerPractice';\n\nexport type MetronomeSound = 'classic' | 'wood' | 'rim' | 'cowbell';\n",
    'engine import',
)
engine = replace_once(
    engine,
    "  gapMuteBars: number;\n}\n",
    "  gapMuteBars: number;\n  rhythmEnabled?: boolean;\n  rhythmPattern?: DrumPattern;\n  rhythmVolume?: number;\n  movingAccentStep?: number | null;\n}\n",
    'engine settings',
)
engine = replace_once(
    engine,
    "  barIndex: number;\n  audible: boolean;\n}",
    "  barIndex: number;\n  stepInBar: number;\n  audible: boolean;\n}",
    'tick step',
)
engine = replace_once(
    engine,
    "    const accented = subdivisionInBeat === 0 && Boolean(settings.accents[beatInBar]);\n\n    if (audible) this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);\n",
    "    const stepInBar = beatInBar * 4 + (settings.subdivision === 4\n      ? subdivisionInBeat\n      : Math.min(3, Math.floor(subdivisionInBeat * 4 / settings.subdivision)));\n    const movingAccent = settings.movingAccentStep === stepInBar;\n    const accented = (subdivisionInBeat === 0 && Boolean(settings.accents[beatInBar])) || movingAccent;\n\n    if (audible) {\n      if (settings.rhythmEnabled && settings.rhythmPattern && settings.subdivision === 4) {\n        const sounded = this.scheduleDrumPatternStep(when, stepInBar, movingAccent, settings);\n        if (movingAccent && !sounded) this.scheduleClick(when, true, true, settings);\n      } else {\n        this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);\n      }\n    }\n",
    'engine schedule mode',
)
engine = replace_once(
    engine,
    "      this.onTick?.({ beatInBar, subdivisionInBeat, barIndex, audible });\n",
    "      this.onTick?.({ beatInBar, subdivisionInBeat, barIndex, stepInBar, audible });\n",
    'tick callback',
)
engine = replace_once(
    engine,
    "  private scheduleClick(\n",
    "  private scheduleDrumPatternStep(\n    when: number,\n    stepInBar: number,\n    movingAccent: boolean,\n    settings: StandaloneMetronomeSettings,\n  ): boolean {\n    const pattern = settings.rhythmPattern;\n    if (!pattern) return false;\n    const instruments: DrumInstrument[] = ['kick', 'snare', 'hihat'];\n    let sounded = false;\n    instruments.forEach((instrument) => {\n      const level = pattern.steps[instrument]?.[stepInBar] ?? 0;\n      if (level === 0) return;\n      sounded = true;\n      this.scheduleDrumVoice(when, instrument, level === 2 || movingAccent, settings.rhythmVolume ?? settings.volume);\n    });\n    return sounded;\n  }\n\n  private scheduleDrumVoice(\n    when: number,\n    instrument: DrumInstrument,\n    accent: boolean,\n    volume: number,\n  ): void {\n    const context = this.context;\n    if (!context || context.state !== 'running') return;\n    const oscillator = context.createOscillator();\n    const gain = context.createGain();\n    const level = clamp(volume, 0, 1) * (accent ? 0.9 : 0.58);\n    const decay = instrument === 'hihat' ? 0.035 : instrument === 'snare' ? 0.07 : 0.11;\n\n    oscillator.type = instrument === 'hihat' ? 'square' : instrument === 'snare' ? 'triangle' : 'sine';\n    if (instrument === 'kick') {\n      oscillator.frequency.setValueAtTime(accent ? 170 : 135, when);\n      oscillator.frequency.exponentialRampToValueAtTime(48, when + decay);\n    } else if (instrument === 'snare') {\n      oscillator.frequency.setValueAtTime(accent ? 245 : 195, when);\n    } else {\n      oscillator.frequency.setValueAtTime(accent ? 7200 : 5800, when);\n    }\n\n    gain.gain.setValueAtTime(0.0001, when);\n    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), when + 0.002);\n    gain.gain.exponentialRampToValueAtTime(0.0001, when + decay);\n    oscillator.connect(gain);\n    gain.connect(context.destination);\n    this.scheduledSources.add(oscillator);\n    oscillator.addEventListener('ended', () => {\n      this.scheduledSources.delete(oscillator);\n      oscillator.disconnect();\n      gain.disconnect();\n    }, { once: true });\n    oscillator.start(when);\n    oscillator.stop(when + decay + 0.02);\n  }\n\n  private scheduleClick(\n",
    'drum voice methods',
)
engine_path.write_text(engine, encoding='utf-8')

# Wire the four training features into the metronome page.
page_path = Path('src/pages/MetronomeLabPage.tsx')
page = page_path.read_text(encoding='utf-8')
page = replace_once(
    page,
    "import BpmNumberInput from '../components/BpmNumberInput';\n",
    "import BpmNumberInput from '../components/BpmNumberInput';\nimport DrummerTrainingSuite from '../components/DrummerTrainingSuite';\n",
    'suite import',
)
page = replace_once(
    page,
    "import { clampBpm } from '../lib/bpm';\n",
    "import { clampBpm } from '../lib/bpm';\nimport {\n  DEFAULT_CUSTOM_PATTERN,\n  DEFAULT_ROUTINE,\n  grooveById,\n  nextMovingAccentIndex,\n  normalizePattern,\n  type DrumPattern,\n  type PracticeRoutineStep,\n} from '../lib/drummerPractice';\n",
    'practice imports',
)
page = replace_once(
    page,
    "  practicePresetIndex: number;\n}",
    "  practicePresetIndex: number;\n  rhythmEnabled: boolean;\n  rhythmPattern: DrumPattern;\n  accentTrainerEnabled: boolean;\n  accentEveryBars: number;\n  accentMode: 'forward' | 'random';\n  movingAccentStep: number;\n  routineSteps: PracticeRoutineStep[];\n}",
    'stored interface',
)
page = replace_once(
    page,
    "  practicePresetIndex: 1,\n};",
    "  practicePresetIndex: 1,\n  rhythmEnabled: false,\n  rhythmPattern: DEFAULT_CUSTOM_PATTERN,\n  accentTrainerEnabled: false,\n  accentEveryBars: 1,\n  accentMode: 'forward',\n  movingAccentStep: 0,\n  routineSteps: DEFAULT_ROUTINE,\n};",
    'stored defaults',
)
page = replace_once(
    page,
    "function readSettings(): StoredLabSettings {\n",
    "function normalizeRoutine(value: unknown): PracticeRoutineStep[] {\n  if (!Array.isArray(value) || value.length === 0) return DEFAULT_ROUTINE.map((step) => ({ ...step }));\n  return value.slice(0, 12).map((raw, index) => {\n    const item = raw as Partial<PracticeRoutineStep>;\n    return {\n      id: typeof item.id === 'string' ? item.id : `step-${index + 1}`,\n      name: typeof item.name === 'string' && item.name.trim() ? item.name : `단계 ${index + 1}`,\n      bpm: clampBpm(Number(item.bpm) || 90),\n      bars: Math.min(128, Math.max(1, Math.round(Number(item.bars) || 8))),\n      patternId: typeof item.patternId === 'string' ? item.patternId : 'basic-rock',\n      accentTrainer: Boolean(item.accentTrainer),\n    };\n  });\n}\n\nfunction readSettings(): StoredLabSettings {\n",
    'routine normalizer',
)
page = replace_once(
    page,
    "      practicePresetIndex: Math.min(\n",
    "      rhythmPattern: normalizePattern(stored.rhythmPattern),\n      routineSteps: normalizeRoutine(stored.routineSteps),\n      accentEveryBars: [1, 2, 4].includes(Number(stored.accentEveryBars)) ? Number(stored.accentEveryBars) : 1,\n      accentMode: stored.accentMode === 'random' ? 'random' : 'forward',\n      movingAccentStep: Math.min(15, Math.max(0, Math.round(Number(stored.movingAccentStep) || 0))),\n      practicePresetIndex: Math.min(\n",
    'stored normalization',
)
page = replace_once(
    page,
    "  const barCountRef = useRef(0);\n",
    "  const barCountRef = useRef(0);\n  const routineBarRef = useRef(0);\n  const routineRunningRef = useRef(false);\n  const routineIndexRef = useRef(0);\n  const pendingRoutineStartRef = useRef(false);\n",
    'routine refs',
)
page = replace_once(
    page,
    "  const [practicePresetIndex, setPracticePresetIndex] = useState(initial.practicePresetIndex);\n",
    "  const [practicePresetIndex, setPracticePresetIndex] = useState(initial.practicePresetIndex);\n  const [rhythmEnabled, setRhythmEnabled] = useState(initial.rhythmEnabled);\n  const [rhythmPattern, setRhythmPattern] = useState<DrumPattern>(normalizePattern(initial.rhythmPattern));\n  const [accentTrainerEnabled, setAccentTrainerEnabled] = useState(initial.accentTrainerEnabled);\n  const [accentEveryBars, setAccentEveryBars] = useState(initial.accentEveryBars);\n  const [accentMode, setAccentMode] = useState<'forward' | 'random'>(initial.accentMode);\n  const [movingAccentStep, setMovingAccentStep] = useState(initial.movingAccentStep);\n  const [routineSteps, setRoutineSteps] = useState<PracticeRoutineStep[]>(normalizeRoutine(initial.routineSteps));\n  const [routineRunning, setRoutineRunning] = useState(false);\n  const [routineIndex, setRoutineIndex] = useState(0);\n  const [routineBarInStep, setRoutineBarInStep] = useState(0);\n  const [activeStep, setActiveStep] = useState(0);\n",
    'feature states',
)
page = replace_once(
    page,
    "  const voiceSupported = isKoreanCountVoiceSupported();\n",
    "  routineRunningRef.current = routineRunning;\n  routineIndexRef.current = routineIndex;\n  const routineStepsRef = useRef(routineSteps);\n  routineStepsRef.current = routineSteps;\n  const rhythmPatternRef = useRef(rhythmPattern);\n  rhythmPatternRef.current = rhythmPattern;\n  const accentTrainerRef = useRef({ enabled: accentTrainerEnabled, everyBars: accentEveryBars, mode: accentMode });\n  accentTrainerRef.current = { enabled: accentTrainerEnabled, everyBars: accentEveryBars, mode: accentMode };\n\n  const voiceSupported = isKoreanCountVoiceSupported();\n",
    'feature refs',
)
page = replace_once(
    page,
    "      gapMuteBars,\n    }),",
    "      gapMuteBars,\n      rhythmEnabled,\n      rhythmPattern,\n      rhythmVolume: volume,\n      movingAccentStep: accentTrainerEnabled ? movingAccentStep : null,\n    }),",
    'settings values',
)
page = replace_once(
    page,
    "      gapPlayBars,\n      sound,\n",
    "      gapPlayBars,\n      rhythmEnabled,\n      rhythmPattern,\n      accentTrainerEnabled,\n      movingAccentStep,\n      sound,\n",
    'settings deps',
)
page = replace_once(
    page,
    "        practicePresetIndex,\n      }),",
    "        practicePresetIndex,\n        rhythmEnabled,\n        rhythmPattern,\n        accentTrainerEnabled,\n        accentEveryBars,\n        accentMode,\n        movingAccentStep,\n        routineSteps,\n      }),",
    'persistence values',
)
page = replace_once(
    page,
    "  }, [countMode, practicePresetIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);\n",
    "  }, [accentEveryBars, accentMode, accentTrainerEnabled, countMode, movingAccentStep, practicePresetIndex, rhythmEnabled, rhythmPattern, routineSteps, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]);\n",
    'persistence deps',
)
page = replace_once(
    page,
    "  const start = useCallback(async () => {\n",
    "  const applyRoutineStep = useCallback((step: PracticeRoutineStep) => {\n    const nextPattern = grooveById(step.patternId, rhythmPatternRef.current);\n    setBpm(clampBpm(step.bpm));\n    setBeatsPerBar(4);\n    setSubdivision(4);\n    setSwing(nextPattern.swing);\n    setRhythmPattern(nextPattern);\n    setRhythmEnabled(true);\n    setAccentTrainerEnabled(step.accentTrainer);\n    setTimerMinutes(0);\n    setMovingAccentStep(0);\n  }, []);\n\n  const start = useCallback(async () => {\n",
    'routine apply function',
)
page = replace_once(
    page,
    "        setAudible(tick.audible);\n",
    "        setAudible(tick.audible);\n        setActiveStep(tick.stepInBar);\n",
    'active sequencer step',
)
page = replace_once(
    page,
    "          if (trainerEnabled && nextBars % Math.max(1, trainerBars) === 0) {\n            setBpm((current) => Math.min(clampBpm(trainerTarget), current + Math.max(1, trainerStep)));\n          }\n",
    "          if (trainerEnabled && nextBars % Math.max(1, trainerBars) === 0) {\n            setBpm((current) => Math.min(clampBpm(trainerTarget), current + Math.max(1, trainerStep)));\n          }\n\n          const accentConfig = accentTrainerRef.current;\n          if (accentConfig.enabled && nextBars % Math.max(1, accentConfig.everyBars) === 0) {\n            setMovingAccentStep((current) => nextMovingAccentIndex(current, accentConfig.mode));\n          }\n\n          if (routineRunningRef.current) {\n            const steps = routineStepsRef.current;\n            const currentIndex = routineIndexRef.current;\n            const currentStep = steps[currentIndex];\n            const completedInStep = routineBarRef.current + 1;\n            if (currentStep && completedInStep >= currentStep.bars) {\n              const nextIndex = currentIndex + 1;\n              if (nextIndex < steps.length) {\n                routineBarRef.current = 0;\n                routineIndexRef.current = nextIndex;\n                setRoutineIndex(nextIndex);\n                setRoutineBarInStep(0);\n                applyRoutineStep(steps[nextIndex]);\n                setNotice(`루틴 ${nextIndex + 1}단계 · ${steps[nextIndex].name}`);\n              } else {\n                routineRunningRef.current = false;\n                setRoutineRunning(false);\n                setNotice('연습 루틴을 모두 완료했습니다.');\n                window.setTimeout(() => stop(), 0);\n              }\n            } else {\n              routineBarRef.current = completedInStep;\n              setRoutineBarInStep(completedInStep);\n            }\n          }\n",
    'bar automation',
)
page = replace_once(
    page,
    "  }, [countMode, engineSettings, trainerBars, trainerEnabled, trainerStep, trainerTarget, voiceSupported]);\n",
    "  }, [applyRoutineStep, countMode, engineSettings, stop, trainerBars, trainerEnabled, trainerStep, trainerTarget, voiceSupported]);\n",
    'start deps',
)
page = replace_once(
    page,
    "  const testVoice = useCallback(async () => {\n",
    "  useEffect(() => {\n    if (!pendingRoutineStartRef.current || running) return;\n    pendingRoutineStartRef.current = false;\n    const timer = window.setTimeout(() => void start(), 50);\n    return () => window.clearTimeout(timer);\n  }, [engineSettings, running, start]);\n\n  const testVoice = useCallback(async () => {\n",
    'routine autostart effect',
)
page = replace_once(
    page,
    "  const practicePreset = PRACTICE_PRESETS[Math.min(PRACTICE_PRESETS.length - 1, Math.max(0, practicePresetIndex))];\n",
    "  const applyGroovePattern = (nextPattern: DrumPattern) => {\n    const normalized = normalizePattern(nextPattern);\n    setRhythmPattern(normalized);\n    setRhythmEnabled(true);\n    setSubdivision(4);\n    setSwing(normalized.swing);\n    setNotice(`${normalized.name} 그루브를 적용했습니다.`);\n  };\n\n  const startRoutine = () => {\n    if (running) stop();\n    const steps = normalizeRoutine(routineSteps);\n    setRoutineSteps(steps);\n    routineStepsRef.current = steps;\n    routineBarRef.current = 0;\n    routineIndexRef.current = 0;\n    routineRunningRef.current = true;\n    setRoutineIndex(0);\n    setRoutineBarInStep(0);\n    setRoutineRunning(true);\n    applyRoutineStep(steps[0]);\n    pendingRoutineStartRef.current = true;\n    setNotice(`루틴 1단계 · ${steps[0].name}`);\n  };\n\n  const stopRoutine = () => {\n    routineRunningRef.current = false;\n    setRoutineRunning(false);\n    routineBarRef.current = 0;\n    setRoutineBarInStep(0);\n    if (running) stop();\n    setNotice('연습 루틴을 중지했습니다.');\n  };\n\n  const practicePreset = PRACTICE_PRESETS[Math.min(PRACTICE_PRESETS.length - 1, Math.max(0, practicePresetIndex))];\n",
    'feature handlers',
)
page = replace_once(
    page,
    "          <section className=\"panel lab-panel practice-preset-panel\">\n",
    "          <DrummerTrainingSuite\n            pattern={rhythmPattern}\n            rhythmEnabled={rhythmEnabled}\n            activeStep={activeStep}\n            onPatternChange={setRhythmPattern}\n            onApplyGroove={applyGroovePattern}\n            onRhythmEnabledChange={setRhythmEnabled}\n            accentTrainerEnabled={accentTrainerEnabled}\n            accentEveryBars={accentEveryBars}\n            accentMode={accentMode}\n            movingAccentStep={movingAccentStep}\n            onAccentTrainerChange={(enabled) => { setAccentTrainerEnabled(enabled); if (enabled) setSubdivision(4); }}\n            onAccentEveryBarsChange={setAccentEveryBars}\n            onAccentModeChange={setAccentMode}\n            routineSteps={routineSteps}\n            routineRunning={routineRunning}\n            routineIndex={routineIndex}\n            routineBarInStep={routineBarInStep}\n            onRoutineChange={setRoutineSteps}\n            onStartRoutine={startRoutine}\n            onStopRoutine={stopRoutine}\n          />\n\n          <section className=\"panel lab-panel practice-preset-panel\">\n",
    'suite render',
)
page_path.write_text(page, encoding='utf-8')

# Extend browser coverage without duplicating tests on subsequent runs.
e2e_path = Path('e2e/practice.spec.ts')
e2e = e2e_path.read_text(encoding='utf-8')
marker = "test('drummer training suite supports groove, sequencer and routines'"
if marker not in e2e:
    e2e += """

test('drummer training suite supports groove, sequencer and routines', async ({ page }) => {
  await page.goto('/#metronome');
  const suite = page.getByLabel('그루브 패턴 메트로놈').locator('..');
  await expect(page.getByRole('heading', { name: '리듬·루틴 트레이닝' })).toBeVisible();
  await expect(page.getByLabel('커스텀 리듬 시퀀서')).toBeVisible();
  await expect(page.getByLabel('악센트 이동 트레이너')).toBeVisible();
  await expect(page.getByLabel('연습 루틴 빌더')).toBeVisible();
  await page.getByRole('button', { name: /16비트 펑크/ }).click();
  await expect(page.getByText('16비트 펑크 그루브를 적용했습니다.')).toBeVisible();
  await page.getByLabel('킥 1 강세').click();
  await expect(page.getByLabel('킥 1 무음')).toBeVisible();
  await expectNoPageOverflow(page);
  await expect(suite).toBeVisible();
});
"""
    e2e_path.write_text(e2e, encoding='utf-8')

# Force installed PWAs to receive the new application shell.
sw_path = Path('public/sw.js')
sw = sw_path.read_text(encoding='utf-8')
sw = sw.replace("barloop-shell-v12", "barloop-shell-v13")
sw_path.write_text(sw, encoding='utf-8')
