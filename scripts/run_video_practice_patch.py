from __future__ import annotations

from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[1]
APPLY = ROOT / 'scripts' / 'apply_video_practice_ux.py'
NL = chr(10)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f'Missing runner target: {label}')
    return text.replace(old, new, 1)


# The original patch expected the pre-flash storage layout. Temporarily expose that
# shape, then restore the flash settings together with the new controls afterward.
training_path = ROOT / 'src' / 'pages' / 'DrummerTrainingPage.tsx'
training = training_path.read_text(encoding='utf-8')
training = replace_once(
    training,
    '      accentFlashEnabled,' + NL + '      accentFlash,' + NL,
    '      accentFlashEnabled,' + NL,
    'temporary training storage body',
)
training = replace_once(
    training,
    '  }, [accentEveryBars, accentFlash, accentFlashEnabled,',
    '  }, [accentEveryBars, accentFlashEnabled,',
    'temporary training storage dependencies',
)
training_path.write_text(training, encoding='utf-8')

runpy.run_path(str(APPLY), run_name='__main__')

# App compatibility, current-bar placement and obsolete handler cleanup.
app_path = ROOT / 'src' / 'App.tsx'
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    "const SETTINGS_KEY = 'barloop:practice-settings:v4';",
    "const SETTINGS_KEY = 'barloop:practice-settings:v4';" + NL + "const LEGACY_SETTINGS_KEY = 'barloop:practice-settings:v3';",
    'App legacy storage key',
)
app = app.replace(',\n  type MouseEvent,', '')
app = app.replace(
    "window.localStorage.getItem(SETTINGS_KEY) || '{}'",
    "window.localStorage.getItem(SETTINGS_KEY) || window.localStorage.getItem(LEGACY_SETTINGS_KEY) || '{}'",
)
current_start = app.find('  const currentBarIndex = useMemo(() => {')
if current_start < 0:
    raise RuntimeError('Generated current bar block was not found.')
current_end = app.index(NL + NL + '  const activeLoop', current_start)
current_block = app[current_start:current_end]
app = app[:current_start] + app[current_end:]
seek_index = app.index('  const seekTo = useCallback((seconds: number) => {')
app = app[:seek_index] + current_block + NL + NL + app[seek_index:]
select_start = app.find('  const selectBar = (index: number, event:')
if select_start >= 0:
    select_end = app.index(NL + '  const setTimeBoundary', select_start)
    app = app[:select_start] + app[select_end:]
app = app.replace(
    '    metronomeVolume,' + NL + '    accentVolume,' + NL + '    subdivisionVolume,' + NL + '    metronomeSound,' + NL + '    accentSound,' + NL + '    midiMappings,',
    '    metronomeVolume,' + NL + '    subdivisionVolume,' + NL + '    metronomeSound,' + NL + '    midiMappings,',
)
app_path.write_text(app, encoding='utf-8')

# Media metronome click profiles.
media_engine_path = ROOT / 'src' / 'lib' / 'metronome.ts'
media_engine = media_engine_path.read_text(encoding='utf-8')
media_engine = media_engine.replace(
    '  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {' + NL +
    '  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {',
    '  async resumeAfterInterruption(playConfirmationClick = false): Promise<boolean> {',
)
media_engine = media_engine.replace(
    'oscillator.frequency.setValueAtTime(secondary ? profile.frequency * .72 : profile.frequency, when);',
    'oscillator.frequency.setValueAtTime(accent ? profile.frequency * 1.18 : secondary ? profile.frequency * .72 : profile.frequency, when);',
)
media_engine_path.write_text(media_engine, encoding='utf-8')

# Restore training flash persistence and provide friendly sound/kit controls.
training = training_path.read_text(encoding='utf-8')
training = training.replace(
    "const TRAINING_SOUNDS: MetronomeSound[] = ['classic', 'wood', 'rim', 'cowbell', 'digital', 'clave', 'shaker', 'low'];",
    "const TRAINING_SOUNDS: Array<{ value: MetronomeSound; label: string }> = [" + NL +
    "  { value: 'classic', label: 'Classic' }, { value: 'wood', label: 'Wood Block' }," + NL +
    "  { value: 'rim', label: 'Rim' }, { value: 'cowbell', label: 'Cowbell' }," + NL +
    "  { value: 'digital', label: 'Digital' }, { value: 'clave', label: 'Clave' }," + NL +
    "  { value: 'shaker', label: 'Shaker' }, { value: 'low', label: 'Low Pulse' }," + NL +
    "];" + NL + "const TRAINING_SOUND_IDS = TRAINING_SOUNDS.map(({ value }) => value);",
)
training = training.replace(
    "localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}'",
    "localStorage.getItem(STORAGE_KEY) || localStorage.getItem('barloop:drummer-training:v2') || localStorage.getItem(LEGACY_STORAGE_KEY) || '{}'",
)
training = training.replace('TRAINING_SOUNDS.includes(stored.sound as MetronomeSound)', 'TRAINING_SOUND_IDS.includes(stored.sound as MetronomeSound)')
training = training.replace('TRAINING_SOUNDS.includes(stored.accentSound as MetronomeSound)', 'TRAINING_SOUND_IDS.includes(stored.accentSound as MetronomeSound)')
training = replace_once(
    training,
    '      accentFlashEnabled, kitSize, guideClickEnabled, guideSubdivision, clickVolume, accentVolume, subdivisionVolume, sound, accentSound,' + NL,
    '      accentFlashEnabled,' + NL + '      accentFlash,' + NL + '      kitSize,' + NL +
    '      guideClickEnabled,' + NL + '      guideSubdivision,' + NL + '      clickVolume,' + NL +
    '      accentVolume,' + NL + '      subdivisionVolume,' + NL + '      sound,' + NL + '      accentSound,' + NL,
    'training storage body restoration',
)
training = training.replace(
    '  }, [accentEveryBars, accentFlashEnabled, accentSound,',
    '  }, [accentEveryBars, accentFlash, accentFlashEnabled, accentSound,',
)
training = training.replace('    subdivision: rhythmEnabled ? 4 : guideSubdivision,', '    subdivision: 4,')
training = training.replace('    clickOverlayEnabled: rhythmEnabled && guideClickEnabled,', '    clickOverlayEnabled: guideClickEnabled,')
training = training.replace(
    '{TRAINING_SOUNDS.map((value) => <option key={value} value={value}>{value}</option>)}',
    '{TRAINING_SOUNDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}',
)
training_path.write_text(training, encoding='utf-8')

# Guide clicks may run with or without the groove pattern.
standalone_path = ROOT / 'src' / 'lib' / 'standaloneMetronome.ts'
standalone = standalone_path.read_text(encoding='utf-8')
standalone = replace_once(
    standalone,
    "      } else if (settings.clickEnabled !== false) {" + NL +
    "        this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);" + NL + "      }",
    "      } else if (settings.clickEnabled !== false) {" + NL +
    "        if (settings.guideSubdivision) this.scheduleGuideOverlay(when, beatInBar, subdivisionInBeat, settings);" + NL +
    "        else this.scheduleClick(when, accented, subdivisionInBeat !== 0, settings);" + NL + "      }",
    'standalone guide-only mode',
)
standalone_path.write_text(standalone, encoding='utf-8')

print('Prepared final video practice and drummer training source.')
