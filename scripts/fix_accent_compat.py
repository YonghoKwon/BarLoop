from pathlib import Path

path = Path('src/components/DrummerTrainingSuite.tsx')
text = path.read_text(encoding='utf-8')
old = """                              subIndex === 0 ? 'downbeat-cell' : subIndex === 2 ? 'eighth-offbeat-cell' : 'sixteenth-between-cell',
                              level === 2 ? 'accent' : level === 1 ? 'on' : '',"""
new = """                              subIndex > 0 ? 'offbeat-cell' : 'downbeat-cell',
                              subIndex === 2 ? 'ampersand-cell' : '',
                              subIndex === 2 ? 'eighth-offbeat-cell' : subIndex > 0 ? 'sixteenth-between-cell' : '',
                              level === 2 ? 'accent' : level === 1 ? 'on' : '',"""
if old not in text:
    raise RuntimeError('Expected sequencer class block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
