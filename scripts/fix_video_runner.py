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
text, marker_count = re.subn(
    r"^marker = .*$",
    "marker = 'app = replace_once(app, \\\"            <div className='",
    text,
    count=1,
    flags=re.MULTILINE,
)
needle = "app = app.replace(',\\n  type MouseEvent,', '')"
replacement = "app = app.replace(\"const SETTINGS_KEY = 'barloop:practice-settings:v4';\", \"const SETTINGS_KEY = 'barloop:practice-settings:v4';\\nconst LEGACY_SETTINGS_KEY = 'barloop:practice-settings:v3';\")\n" + needle
if needle not in text:
    raise RuntimeError('Could not find App compatibility section in video runner.')
text = text.replace(needle, replacement, 1)

if settings_count != 1 or marker_count != 1:
    raise RuntimeError('Could not update video practice runner setup.')
path.write_text(text, encoding='utf-8')
