from __future__ import annotations

from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
APPLY = ROOT / 'scripts' / 'apply_video_practice_ux.py'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing runner target: {label}')
    return text.replace(old, new, 1)


script = APPLY.read_text(encoding='utf-8')
script = script.replace(
    "const SETTINGS_KEY = 'barloop:practice-settings:v4';\\nconst METRONOME_SOUNDS",
    "const SETTINGS_KEY = 'barloop:practice-settings:v4';\\nconst LEGACY_SETTINGS_KEY = 'barloop:practice-settings:v3';\\nconst METRONOME_SOUNDS",
)
script = script.replace(
    "const SETTINGS_KEY = 'barloop:practice-settings:v3';",
    "const SETTINGS_KEY = 'barloop:practice-settings:v4';\\nconst LEGACY_SETTINGS_KEY = 'barloop:practice-settings:v3';",
)
current_before_clock = '''app = replace_once(app, "  const activeLoop = useMemo(() => {", "  const currentBarIndex = useMemo(() => {\\n    if (bars.length === 0) return -1;\\n    const found = bars.findIndex((bar) => currentTime >= bar.start && currentTime < bar.end);\\n    if (found >= 0) return found;\\n    return currentTime >= bars[bars.length - 1].end ? bars.length - 1 : -1;\\n  }, [bars, currentTime]);\\n\\n  const activeLoop = useMemo(() => {", 'App current bar')
'''
script = script.replace(current_before_clock, '# Current bar is inserted after usePlaybackClock.\n')
current_after_clock = '''app = replace_once(app, "  const seekTo = useCallback((seconds: number) => {", "  const currentBarIndex = useMemo(() => {\\n    if (bars.length === 0) return -1;\\n    const found = bars.findIndex((bar) => currentTime >= bar.start && currentTime < bar.end);\\n    if (found >= 0) return found;\\n    return currentTime >= bars[bars.length - 1].end ? bars.length - 1 : -1;\\n  }, [bars, currentTime]);\\n\\n  const seekTo = useCallback((seconds: number) => {", 'App current bar after clock')\n'''
marker = 'app = replace_once(app, "            <div className=\\"transport-row sticky-mobile-controls\\">"'
if current_after_clock not in script:
    index = script.index(marker)
    script = script[:index] + current_after_clock + script[index:]
script = script.replace(
    'page = replace_once(page, "      accentFlashEnabled,\\n    }));", "      accentFlashEnabled, kitSize, guideClickEnabled, guideSubdivision, clickVolume, accentVolume, subdivisionVolume, sound, accentSound,\\n    }));", \'training storage body\')',
    '''page = replace_once(page, "      accentFlashEnabled,\\n      accentFlash,\\n    }));", "      accentFlashEnabled,\\n      accentFlash,\\n      kitSize,\\n      guideClickEnabled,\\n      guideSubdivision,\\n      clickVolume,\\n      accentVolume,\\n      subdivisionVolume,\\n      sound,\\n      accentSound,\\n    }));", 'training storage body')''',
)
script = script.replace(
    'page = replace_once(page, "  }, [accentEveryBars, accentFlashEnabled,", "  }, [accentEveryBars, accentFlashEnabled, accentSound, accentVolume, clickVolume, guideClickEnabled, guideSubdivision, kitSize, sound, subdivisionVolume,", \'training storage deps\')',
    '''page = replace_once(page, "  }, [accentEveryBars, accentFlash, accentFlashEnabled, accentMode, accentTrainerEnabled, bpm, movingAccentStep, pattern, rhythmEnabled, routineSteps, volume]);", "  }, [accentEveryBars, accentFlash, accentFlashEnabled, accentMode, accentSound, accentTrainerEnabled, accentVolume, bpm, clickVolume, guideClickEnabled, guideSubdivision, kitSize, movingAccentStep, pattern, rhythmEnabled, routineSteps, sound, subdivisionVolume, volume]);", 'training storage deps')''',
)
APPLY.write_text(script, encoding='utf-8')
runpy.run_path(str(APPLY), run_name='__main__')

# Final compatibility and behavior fixes after the generated patch.
app_path = ROOT / 'src' / 'App.tsx'
app = app_path.read_text(encoding='utf-8')
app = app.replace(',\n  type MouseEvent,', '')
app = app.replace(
    "window.localStorage.getItem(SETTINGS_KEY) || '{}'",
    "window.localStorage.getItem(SETTINGS_KEY) || window.localStorage.getItem(LEGACY_SETTINGS_KEY) || '{}'",
)
start = app.find('  const selectBar = (index: number, event:')
if start >= 0:
    end = app.index('\n  const setTimeBoundary', start)
    app = app[:start] + app[end:]
app = app.replace(
    '    metronomeVolume,\n    accentVolume,\n    subdivisionVolume,\n    metronomeSound,\n    accentSound,\n    midiMappings,',
    '    metronomeVolume,\n    subdivisionVolume,\n    metronomeSound,\n    midiMappings,',
)
app_path.write_text(app, encoding='utf-8')

media_engine_path = ROOT / 'src' / 'lib' / 'metronome.ts'
media_engine = media_engine_path.read_text(encoding='utf-8')
media_engine = media_engine.replace(
    '  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {\n  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {',
    '  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {',
)
media_engine = media_engine.replace(
    'oscillator.frequency.setValueAtTime(secondary ? profile.frequency * .72 : profile.frequency, when);',
    'oscillator.frequency.setValueAtTime(accent ? profile.frequency * 1.18 : secondary ? profile.frequency * .72 : profile.frequency, when);',
)
media_engine_path.write_text(media_engine, encoding='utf-8')

training_path = ROOT / 'src' / 'pages' / 'DrummerTrainingPage.tsx'
training = training_path.read_text(encoding='utf-8')
training = training.replace(
    "const TRAINING_SOUNDS: MetronomeSound[] = ['classic', 'wood', 'rim', 'cowbell', 'digital', 'clave', 'shaker', 'low'];",
    "const TRAINING_SOUNDS: Array<{ value: MetronomeSound; label: string }> = [\n  { value: 'classic', label: 'Classic' }, { value: 'wood', label: 'Wood Block' },\n  { value: 'rim', label: 'Rim' }, { value: 'cowbell', label: 'Cowbell' },\n  { value: 'digital', label: 'Digital' }, { value: 'clave', label: 'Clave' },\n  { value: 'shaker', label: 'Shaker' }, { value: 'low', label: 'Low Pulse' },\n];\nconst TRAINING_SOUND_IDS = TRAINING_SOUNDS.map(({ value }) => value);",
)
training = training.replace(
    "localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}'",
    "localStorage.getItem(STORAGE_KEY) || localStorage.getItem('barloop:drummer-training:v2') || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}'",
)
training = training.replace('TRAINING_SOUNDS.includes(stored.sound as MetronomeSound)', 'TRAINING_SOUND_IDS.includes(stored.sound as MetronomeSound)')
training = training.replace('TRAINING_SOUNDS.includes(stored.accentSound as MetronomeSound)', 'TRAINING_SOUND_IDS.includes(stored.accentSound as MetronomeSound)')
training = training.replace('    subdivision: rhythmEnabled ? 4 : guideSubdivision,', '    subdivision: 4,')
training = training.replace('    clickOverlayEnabled: rhythmEnabled && guideClickEnabled,', '    clickOverlayEnabled: guideClickEnabled,')
training = training.replace(
    '{TRAINING_SOUNDS.map((value) => <option key={value} value={value}>{value}</option>)}',
    '{TRAINING_SOUNDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}',
)
training_path.write_text(training, encoding='utf-8')

standalone_path = ROOT / 'src' / 'lib' / 'standaloneMetronome.ts'
standalone = standalone_path.read_text(encoding='utf-8')
standalone = replace_once(
    standalone,
    "      } else if (settings.clickEnabled !== false) {\n        this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);\n      }",
    "      } else if (settings.clickEnabled !== false) {\n        if (settings.guideSubdivision) this.scheduleGuideOverlay(when, beatInBar, subdivisionInBeat, settings);\n        else this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);\n      }",
    'standalone guide-only mode',
)
standalone_path.write_text(standalone, encoding='utf-8')

print('Prepared final video practice and drummer training source.')
