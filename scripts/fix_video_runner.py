from pathlib import Path
import re

path = Path(__file__).with_name('run_video_practice_patch.py')
text = path.read_text(encoding='utf-8')

text, settings_count = re.subn(
    r"script = APPLY\.read_text\(encoding='utf-8'\).*?current_before_clock =",
    "script = APPLY.read_text(encoding='utf-8')\ncurrent_before_clock =",
    text,
    count=1,
    flags=re.DOTALL,
)
text, current_patch_count = re.subn(
    r"current_before_clock =.*?(?=script = script\.replace\(\n    'page = replace_once)",
    "",
    text,
    count=1,
    flags=re.DOTALL,
)

needle = "app = app_path.read_text(encoding='utf-8')"
move_block = '''app = app_path.read_text(encoding='utf-8')
current_start = app.find('  const currentBarIndex = useMemo(() => {')
if current_start >= 0:
    current_end = app.index('\n\n  const activeLoop', current_start)
    current_block = app[current_start:current_end]
    app = app[:current_start] + app[current_end:]
    seek_index = app.index('  const seekTo = useCallback((seconds: number) => {')
    app = app[:seek_index] + current_block + '\n\n' + app[seek_index:]
'''
if needle not in text:
    raise RuntimeError('Could not find App post-processing section in video runner.')
text = text.replace(needle, move_block.rstrip(), 1)

mouse_needle = "app = app.replace(',\\n  type MouseEvent,', '')"
settings_replacement = "app = app.replace(\"const SETTINGS_KEY = 'barloop:practice-settings:v4';\", \"const SETTINGS_KEY = 'barloop:practice-settings:v4';\\nconst LEGACY_SETTINGS_KEY = 'barloop:practice-settings:v3';\")\n" + mouse_needle
if mouse_needle not in text:
    raise RuntimeError('Could not find App compatibility section in video runner.')
text = text.replace(mouse_needle, settings_replacement, 1)

if settings_count != 1 or current_patch_count != 1:
    raise RuntimeError('Could not update video practice runner setup.')
path.write_text(text, encoding='utf-8')
