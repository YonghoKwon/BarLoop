from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Missing patch target: {label}")
    return text.replace(old, new, 1)


component = '''import type { Subdivision } from '../lib/metronome';
import {
  buildSubdivisionCountGroups,
  getVisualSubdivision,
  getVisualSubdivisionIndex,
  isSubdivisionSoundCell,
} from '../lib/subdivisionCount';

interface SubdivisionCountGuideProps {
  beatsPerBar: number;
  subdivision: Subdivision;
  beatInBar: number;
  subdivisionInBeat: number;
  audible?: boolean;
  compact?: boolean;
  className?: string;
}

export default function SubdivisionCountGuide({
  beatsPerBar,
  subdivision,
  beatInBar,
  subdivisionInBeat,
  audible = true,
  compact = false,
  className = '',
}: SubdivisionCountGuideProps) {
  const visualSubdivision = getVisualSubdivision(subdivision);
  const groups = buildSubdivisionCountGroups(beatsPerBar, visualSubdivision);
  const activeVisualIndex = getVisualSubdivisionIndex(subdivision, subdivisionInBeat);

  return (
    <div
      className={['shared-subdivision-guide', compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      aria-label="한 마디 서브디비전 카운트"
    >
      {groups.map((labels, countBeatIndex) => (
        <div
          key={countBeatIndex}
          className={countBeatIndex === beatInBar ? 'shared-count-beat active-beat' : 'shared-count-beat'}
        >
          {labels.map((label, countSubdivisionIndex) => {
            const soundCell = isSubdivisionSoundCell(subdivision, countSubdivisionIndex);
            const active = countBeatIndex === beatInBar && countSubdivisionIndex === activeVisualIndex;
            return (
              <span
                key={`${countBeatIndex}-${countSubdivisionIndex}`}
                className={[
                  soundCell ? 'sound-on' : 'guide-only',
                  active ? 'active' : '',
                  active && !audible ? 'muted' : '',
                ].filter(Boolean).join(' ')}
                title={soundCell ? '실제 클릭이 나는 위치' : '소리 없이 박을 나누어 보는 안내 위치'}
              >
                <strong>{label}</strong>
                <i aria-hidden="true" />
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
'''
Path('src/components/SubdivisionCountGuide.tsx').write_text(component)

metronome_panel = '''import type { Subdivision } from '../lib/metronome';
import { getCurrentSubdivisionCount } from '../lib/subdivisionCount';
import SubdivisionCountGuide from './SubdivisionCountGuide';

interface MetronomePanelProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  countInBars: number;
  onCountInBarsChange: (bars: number) => void;
  subdivision: Subdivision;
  onSubdivisionChange: (subdivision: Subdivision) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  gapEnabled: boolean;
  onGapEnabledChange: (enabled: boolean) => void;
  gapPlayBars: number;
  gapMuteBars: number;
  onGapPlayBarsChange: (bars: number) => void;
  onGapMuteBarsChange: (bars: number) => void;
  beatInBar: number;
  subdivisionInBeat: number;
  beatsPerBar: number;
  audibleBeat: boolean;
  countInRemaining: number | null;
}

export default function MetronomePanel({
  enabled,
  onEnabledChange,
  countInBars,
  onCountInBarsChange,
  subdivision,
  onSubdivisionChange,
  volume,
  onVolumeChange,
  gapEnabled,
  onGapEnabledChange,
  gapPlayBars,
  gapMuteBars,
  onGapPlayBarsChange,
  onGapMuteBarsChange,
  beatInBar,
  subdivisionInBeat,
  beatsPerBar,
  audibleBeat,
  countInRemaining,
}: MetronomePanelProps) {
  const currentCount = getCurrentSubdivisionCount(beatInBar, subdivisionInBeat, subdivision);

  return (
    <section className="panel tool-panel metronome-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">CLICK</span>
          <h2>메트로놈·카운트인</h2>
        </div>
        <label className="switch-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>{enabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>

      <div className="metronome-count-readout">
        <strong>{currentCount}</strong>
        <span>{countInRemaining !== null ? 'COUNT IN' : audibleBeat ? 'CLICK' : 'GAP'}</span>
      </div>

      <SubdivisionCountGuide
        beatsPerBar={beatsPerBar}
        subdivision={subdivision}
        beatInBar={beatInBar}
        subdivisionInBeat={subdivisionInBeat}
        audible={audibleBeat}
        compact
      />

      {countInRemaining !== null && (
        <div className="count-in-banner" role="status">
          카운트인 <strong>{countInRemaining}</strong>박 남음 · 현재 <strong>{currentCount}</strong>
        </div>
      )}

      <div className="compact-grid three">
        <label>
          카운트인
          <select value={countInBars} onChange={(event) => onCountInBarsChange(Number(event.target.value))}>
            <option value={0}>없음</option>
            <option value={1}>1마디</option>
            <option value={2}>2마디</option>
            <option value={4}>4마디</option>
          </select>
        </label>
        <label>
          서브디비전
          <select
            value={subdivision}
            onChange={(event) => onSubdivisionChange(Number(event.target.value) as Subdivision)}
          >
            <option value={1}>4분음표</option>
            <option value={2}>8분음표</option>
            <option value={3}>셋잇단</option>
            <option value={4}>16분음표</option>
          </select>
        </label>
        <label>
          클릭 음량 {Math.round(volume * 100)}%
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="gap-click-row">
        <label className="switch-label">
          <input
            type="checkbox"
            checked={gapEnabled}
            onChange={(event) => onGapEnabledChange(event.target.checked)}
          />
          <span>Gap Click</span>
        </label>
        <label>
          소리
          <input
            type="number"
            min={1}
            max={16}
            value={gapPlayBars}
            onChange={(event) => onGapPlayBarsChange(Number(event.target.value))}
          />
          마디
        </label>
        <label>
          무음
          <input
            type="number"
            min={1}
            max={16}
            value={gapMuteBars}
            onChange={(event) => onGapMuteBarsChange(Number(event.target.value))}
          />
          마디
        </label>
      </div>
      <p className="hint">4분음표에서도 1 e & a 격자를 유지하며, 실제 소리가 나는 칸은 점으로 구분합니다.</p>
    </section>
  );
}
'''
Path('src/components/MetronomePanel.tsx').write_text(metronome_panel)

practice_overlay = '''import type { Subdivision } from '../lib/metronome';
import { getCurrentSubdivisionCount } from '../lib/subdivisionCount';
import { formatTime } from '../lib/time';
import SubdivisionCountGuide from './SubdivisionCountGuide';

interface PracticeModeOverlayProps {
  visible: boolean;
  isPlaying: boolean;
  bpm: number;
  playbackRate: number;
  currentTime: number;
  loopStart: number;
  loopEnd: number;
  loopCount: number;
  currentBeat: number;
  subdivisionInBeat: number;
  subdivision: Subdivision;
  beatsPerBar: number;
  metronomeEnabled: boolean;
  audibleBeat: boolean;
  countInRemaining: number | null;
  wakeLockActive: boolean;
  onClose: () => void;
  onTogglePlayback: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onNext: () => void;
  onToggleWakeLock: () => void;
}

export default function PracticeModeOverlay({
  visible,
  isPlaying,
  bpm,
  playbackRate,
  currentTime,
  loopStart,
  loopEnd,
  loopCount,
  currentBeat,
  subdivisionInBeat,
  subdivision,
  beatsPerBar,
  metronomeEnabled,
  audibleBeat,
  countInRemaining,
  wakeLockActive,
  onClose,
  onTogglePlayback,
  onPrevious,
  onRestart,
  onNext,
  onToggleWakeLock,
}: PracticeModeOverlayProps) {
  if (!visible) return null;

  const currentCount = getCurrentSubdivisionCount(currentBeat, subdivisionInBeat, subdivision);

  return (
    <div className="practice-overlay" role="dialog" aria-modal="true" aria-label="드러머 연습 모드">
      <div className="practice-topbar">
        <strong>DRUM PRACTICE</strong>
        <div className="button-row">
          <button type="button" onClick={onToggleWakeLock}>
            {wakeLockActive ? '화면 유지 ON' : '화면 유지'}
          </button>
          <button type="button" onClick={onClose}>닫기</button>
        </div>
      </div>

      <div className="practice-readout">
        <div>
          <span>BPM</span>
          <strong>{Math.round(bpm * playbackRate)}</strong>
          <small>원곡 {bpm} · {Math.round(playbackRate * 100)}%</small>
        </div>
        <div>
          <span>COUNT</span>
          <strong className="practice-current-count">{currentCount}</strong>
          <small>/ {beatsPerBar} {countInRemaining !== null ? `· COUNT IN ${countInRemaining}` : metronomeEnabled ? `· ${audibleBeat ? 'CLICK' : 'GAP'}` : ''}</small>
        </div>
        <div>
          <span>LOOPS</span>
          <strong>{loopCount}</strong>
          <small>{formatTime(loopStart, true)}–{formatTime(loopEnd, true)}</small>
        </div>
      </div>

      <SubdivisionCountGuide
        beatsPerBar={beatsPerBar}
        subdivision={subdivision}
        beatInBar={currentBeat}
        subdivisionInBeat={subdivisionInBeat}
        audible={audibleBeat}
        className="practice-subdivision-guide"
      />

      <div className="practice-progress" aria-label="현재 반복 구간 진행률">
        <i
          style={{
            width: `${Math.max(0, Math.min(100, ((currentTime - loopStart) / Math.max(0.01, loopEnd - loopStart)) * 100))}%`,
          }}
        />
      </div>

      <div className="practice-controls">
        <button type="button" onClick={onPrevious}>이전</button>
        <button type="button" className="restart" onClick={onRestart}>처음</button>
        <button type="button" className="practice-play" onClick={onTogglePlayback}>
          {isPlaying ? '일시정지' : '재생'}
        </button>
        <button type="button" onClick={onNext}>다음</button>
      </div>
    </div>
  );
}
'''
Path('src/components/PracticeModeOverlay.tsx').write_text(practice_overlay)

metronome_path = Path('src/lib/metronome.ts')
metronome = metronome_path.read_text()
metronome = replace_once(metronome, "  private onBeat: ((beatInBar: number, audible: boolean) => void) | null = null;", "  private onBeat: ((beatInBar: number, subdivisionInBeat: number, audible: boolean) => void) | null = null;", 'metronome callback field')
metronome = replace_once(metronome, "    onBeat?: (beatInBar: number, audible: boolean) => void,", "    onBeat?: (beatInBar: number, subdivisionInBeat: number, audible: boolean) => void,", 'metronome callback argument')
metronome = replace_once(metronome, "      if (subdivisionInBeat === 0) this.onBeat?.(beatInBar, shouldSound);", "      this.onBeat?.(beatInBar, subdivisionInBeat, shouldSound);", 'metronome callback invocation')
metronome_path.write_text(metronome)

app_path = Path('src/App.tsx')
app = app_path.read_text()
app = replace_once(app, "  const [beatInBar, setBeatInBar] = useState(0);\n  const [audibleBeat, setAudibleBeat] = useState(true);", "  const [beatInBar, setBeatInBar] = useState(0);\n  const [subdivisionInBeat, setSubdivisionInBeat] = useState(0);\n  const [audibleBeat, setAudibleBeat] = useState(true);", 'subdivision state')
app = replace_once(app, "            setBeatInBar(beat);\n            setAudibleBeat(true);", "            setBeatInBar(beat);\n            setSubdivisionInBeat(0);\n            setAudibleBeat(true);", 'count-in subdivision state')
app = replace_once(app, "      (beat, audible) => {\n        setBeatInBar(beat);\n        setAudibleBeat(audible);\n      },", "      (beat, nextSubdivisionInBeat, audible) => {\n        setBeatInBar(beat);\n        setSubdivisionInBeat(nextSubdivisionInBeat);\n        setAudibleBeat(audible);\n      },", 'continuous metronome callback')
app = replace_once(app, "beatInBar={beatInBar} beatsPerBar={beatsPerBar} audibleBeat={audibleBeat} countInRemaining={countInRemaining}", "beatInBar={beatInBar} subdivisionInBeat={subdivisionInBeat} beatsPerBar={beatsPerBar} audibleBeat={audibleBeat} countInRemaining={countInRemaining}", 'metronome panel props')
app = replace_once(app, "currentBeat={beatInBar} beatsPerBar={beatsPerBar} metronomeEnabled={metronomeEnabled} wakeLockActive={wakeLock.active}", "currentBeat={beatInBar} subdivisionInBeat={subdivisionInBeat} subdivision={subdivision} beatsPerBar={beatsPerBar} metronomeEnabled={metronomeEnabled} audibleBeat={audibleBeat} countInRemaining={countInRemaining} wakeLockActive={wakeLock.active}", 'practice overlay props')
app_path.write_text(app)

styles_path = Path('src/styles.css')
styles = styles_path.read_text()
styles += '''\n\n/* Shared 1 e & a guide for media practice, metronome and count-in. */
.shared-subdivision-guide { width: min(100%, 980px); display: flex; justify-content: center; gap: 8px; margin: 14px auto; padding: 8px; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: thin; border-radius: 14px; background: rgba(7, 9, 14, .78); }
.shared-count-beat { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, minmax(31px, 1fr)); gap: 4px; padding: 5px; border: 1px solid #2e3545; border-radius: 11px; background: #11151e; }
.shared-count-beat:has(> span:nth-child(3):last-child) { grid-template-columns: repeat(3, minmax(42px, 1fr)); }
.shared-count-beat.active-beat { border-color: rgba(255, 106, 61, .72); background: rgba(255, 106, 61, .09); }
.shared-count-beat span { min-height: 46px; display: grid; grid-template-rows: 1fr 8px; place-items: center; gap: 3px; padding: 5px; border-radius: 8px; color: #8e98aa; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; transition: transform .08s ease, background .08s ease, color .08s ease; }
.shared-count-beat span strong { font-size: .9rem; }
.shared-count-beat span i { width: 7px; height: 7px; border: 1px solid #596274; border-radius: 50%; }
.shared-count-beat span.sound-on { color: #e6e9f0; }
.shared-count-beat span.sound-on i { border: 0; background: var(--accent); }
.shared-count-beat span.guide-only { opacity: .58; }
.shared-count-beat span.active { transform: scale(1.08); background: var(--accent); color: white; box-shadow: 0 0 20px rgba(255,106,61,.28); opacity: 1; }
.shared-count-beat span.active i { background: white; border-color: white; }
.shared-count-beat span.active.muted { background: #394151; color: #aab2bf; box-shadow: none; }
.shared-subdivision-guide.compact { justify-content: flex-start; width: 100%; margin-block: 14px; }
.shared-subdivision-guide.compact .shared-count-beat span { min-height: 40px; }
.metronome-count-readout { display: flex; align-items: baseline; justify-content: center; gap: 10px; margin-top: 15px; }
.metronome-count-readout strong { font-size: clamp(2.4rem, 8vw, 4.8rem); line-height: 1; }
.metronome-count-readout span { color: var(--text-muted); font-size: .72rem; font-weight: 900; letter-spacing: .14em; }
.practice-current-count { font-size: clamp(3rem, 11vw, 8rem) !important; white-space: nowrap; }
.practice-subdivision-guide { width: min(100%, 1100px); margin-block: 4px; background: rgba(5, 7, 10, .9); }
.practice-subdivision-guide .shared-count-beat { flex: 1 0 auto; }
.practice-subdivision-guide .shared-count-beat span { min-width: 38px; min-height: clamp(46px, 8vh, 68px); }
.practice-subdivision-guide .shared-count-beat span strong { font-size: clamp(.85rem, 2vw, 1.25rem); }
@media (max-width: 760px) { .shared-subdivision-guide { justify-content: flex-start; } .shared-count-beat span { min-width: 29px; padding-inline: 3px; } .practice-subdivision-guide { margin-block: 0; } }
@media (orientation: landscape) and (max-height: 520px) { .practice-subdivision-guide { max-height: 68px; padding-block: 4px; } .practice-subdivision-guide .shared-count-beat span { min-height: 48px; } }
'''
styles_path.write_text(styles)

readme_path = Path('README.md')
readme = readme_path.read_text()
needle = '- 현재 서브디비전 시각 표시: `1 &`, `1 trip let`, `1 e & a`\n'
if needle in readme:
    readme = readme.replace(needle, needle + '- 영상·음원 연습 화면과 메트로놈·카운트인에서 동일한 `1 e & a` 격자 표시\n', 1)
readme_path.write_text(readme)

sw_path = Path('public/sw.js')
sw = sw_path.read_text()
for old in ["barloop-shell-v7", "barloop-shell-v6", "barloop-shell-v5"]:
    if old in sw:
        sw = sw.replace(old, "barloop-shell-v8", 1)
        break
sw_path.write_text(sw)

for path in [Path('.github/workflows/apply-media-subdivision-guides.yml'), Path('scripts/apply_media_subdivision_guides.py')]:
    if path.exists():
        path.unlink()
