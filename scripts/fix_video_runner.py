from pathlib import Path
import re

path = Path(__file__).with_name('run_video_practice_patch.py')
text = path.read_text(encoding='utf-8')
text, count = re.subn(
    r"^marker = .*$",
    "marker = 'app = replace_once(app, \\\"            <div className='",
    text,
    count=1,
    flags=re.MULTILINE,
)
if count != 1:
    raise RuntimeError('Could not update video practice runner marker.')
path.write_text(text, encoding='utf-8')
