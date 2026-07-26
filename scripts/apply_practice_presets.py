from pathlib import Path
import re

path = Path('src/pages/MetronomeLabPage.tsx')
text = path.read_text(encoding='utf-8')

PRESETS = """const PRACTICE_PRESETS = [
  {
    name: '8분 기본기',
    description: '느린 템포에서 클릭 사이를 안정적으로 채우며 손과 발의 기본 타이밍을 정리합니다.',
    bpm: 80,
    beatsPerBar: 4,
    subdivision: 2 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 100,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['80 BPM', '8분음표', '10분'],
  },
  {
    name: '16분 균등',
    description: '1 e & a 네 칸의 간격을 같은 크기로 유지하는 데 집중하는 기본 루틴입니다.',
    bpm: 70,
    beatsPerBar: 4,
    subdivision: 4 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 100,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['70 BPM', '16분음표', '균등 연주'],
  },
  {
    name: '백비트 안정',
    description: '2박과 4박을 강조해 스네어 백비트와 그루브 중심을 흔들리지 않게 연습합니다.',
    bpm: 90,
    beatsPerBar: 4,
    subdivision: 2 as MetronomeSubdivision,
    accents: [false, true, false, true],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 110,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['90 BPM', '2·4박 강세', '그루브'],
  },
  {
    name: '내부 박자 점검',
    description: '2마디 클릭 뒤 2마디가 무음이 되어, 클릭 없이도 템포를 유지하는지 확인합니다.',
    bpm: 100,
    beatsPerBar: 4,
    subdivision: 1 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: true,
    gapPlayBars: 2,
    gapMuteBars: 2,
    trainerEnabled: false,
    trainerTarget: 120,
    trainerStep: 5,
    trainerBars: 4,
    timerMinutes: 10,
    tags: ['100 BPM', '2마디 소리', '2마디 무음'],
  },
  {
    name: '16분 속도 올리기',
    description: '80 BPM에서 시작해 8마디마다 5 BPM씩 올리며 120 BPM까지 자연스럽게 확장합니다.',
    bpm: 80,
    beatsPerBar: 4,
    subdivision: 4 as MetronomeSubdivision,
    accents: [true, false, false, false],
    gapEnabled: false,
    gapPlayBars: 4,
    gapMuteBars: 2,
    trainerEnabled: true,
    trainerTarget: 120,
    trainerStep: 5,
    trainerBars: 8,
    timerMinutes: 15,
    tags: ['80→120 BPM', '+5 BPM', '8마디마다'],
  },
] as const;"""


def sub(pattern: str, replacement: str, label: str, flags: int = 0) -> None:
    global text
    text, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    print(f'applied: {label}')


sub(r"const RUDIMENTS = \[.*?\] as const;", PRESETS, 'preset definitions', re.S)
sub(r"  rudimentIndex: number;", "  practicePresetIndex: number;", 'stored setting field')
sub(r"  rudimentIndex: 2,", "  practicePresetIndex: 1,", 'default preset')
sub(
    r"      countMode,\n      bpm: clampBpm",
    """      countMode,
      practicePresetIndex: Math.min(
        PRACTICE_PRESETS.length - 1,
        Math.max(
          0,
          Math.round(Number(stored.practicePresetIndex ?? (stored as { rudimentIndex?: number }).rudimentIndex ?? DEFAULTS.practicePresetIndex)),
        ),
      ),
      bpm: clampBpm""",
    'stored preset migration',
)
sub(
    r"  const \[rudimentIndex, setRudimentIndex\] = useState\(initial\.rudimentIndex\);",
    "  const [practicePresetIndex, setPracticePresetIndex] = useState(initial.practicePresetIndex);",
    'preset state',
)
sub(r"\n\s+rudimentIndex,", "\n        practicePresetIndex,", 'persist preset')
sub(
    r"\[countMode, rudimentIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget\]",
    "[countMode, practicePresetIndex, settings, timerMinutes, trainerBars, trainerEnabled, trainerStep, trainerTarget]",
    'storage dependencies',
)
sub(
    r"  const rudiment = RUDIMENTS\[.*?\];\n  const progress =",
    """  const practicePreset = PRACTICE_PRESETS[Math.min(PRACTICE_PRESETS.length - 1, Math.max(0, practicePresetIndex))];

  const applyPracticePreset = () => {
    if (running) stop();
    setBpm(practicePreset.bpm);
    setBeatsPerBar(practicePreset.beatsPerBar);
    setSubdivision(practicePreset.subdivision);
    setSwing(0.5);
    setAccents([...practicePreset.accents]);
    setGapEnabled(practicePreset.gapEnabled);
    setGapPlayBars(practicePreset.gapPlayBars);
    setGapMuteBars(practicePreset.gapMuteBars);
    setTrainerEnabled(practicePreset.trainerEnabled);
    setTrainerTarget(practicePreset.trainerTarget);
    setTrainerStep(practicePreset.trainerStep);
    setTrainerBars(practicePreset.trainerBars);
    setTimerMinutes(practicePreset.timerMinutes);
    barCountRef.current = 0;
    setBarCount(0);
    setElapsedSeconds(0);
    setNotice(`${practicePreset.name} 프리셋을 적용했습니다. 시작 버튼을 눌러 연습하세요.`);
  };

  const progress =""",
    'preset application',
    re.S,
)
sub(
    r'<div className="subdivision-count-guide" aria-label="한 마디 서브디비전 카운트">',
    "<div className={beatsPerBar <= 4 ? 'subdivision-count-guide fit-full-bar' : 'subdivision-count-guide'} aria-label=\"한 마디 서브디비전 카운트\">",
    'standalone full bar class',
)
sub(
    r"          <section className=\"panel lab-panel rudiment-panel\">.*?          </section>",
    """          <section className="panel lab-panel practice-preset-panel">
            <div className="section-title-row">
              <div>
                <h2>연습 프리셋</h2>
                <span className="subtle">목적에 맞는 메트로놈 설정을 한 번에 적용합니다.</span>
              </div>
              <select
                aria-label="연습 프리셋 선택"
                value={practicePresetIndex}
                onChange={(event) => setPracticePresetIndex(Number(event.target.value))}
              >
                {PRACTICE_PRESETS.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}
              </select>
            </div>
            <div className="practice-preset-summary">
              <strong>{practicePreset.name}</strong>
              <p>{practicePreset.description}</p>
              <div className="practice-preset-tags">
                {practicePreset.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
            <button type="button" className="primary-button" onClick={applyPracticePreset}>
              이 설정으로 연습 준비
            </button>
            <p className="hint">클릭 음색과 음량은 현재 값을 유지하며, BPM·박자·서브디비전·악센트·Gap Click·템포 트레이너·타이머만 변경합니다.</p>
          </section>""",
    'practice preset panel',
    re.S,
)

if 'RUDIMENTS' in text or 'setRudimentIndex' in text:
    raise RuntimeError('legacy rudiment UI remains after migration')

path.write_text(text, encoding='utf-8')
