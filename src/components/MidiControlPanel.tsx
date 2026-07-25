import type { MidiMappings } from '../hooks/useMidiControls';

interface MidiControlPanelProps {
  supported: boolean;
  enabled: boolean;
  connectedInputs: string[];
  lastNote: number | null;
  error: string;
  mappings: MidiMappings;
  onMappingsChange: (mappings: MidiMappings) => void;
  onEnable: () => void;
  onDisable: () => void;
}

export default function MidiControlPanel({
  supported,
  enabled,
  connectedInputs,
  lastNote,
  error,
  mappings,
  onMappingsChange,
  onEnable,
  onDisable,
}: MidiControlPanelProps) {
  const update = (key: keyof MidiMappings, value: number) => {
    onMappingsChange({ ...mappings, [key]: Math.max(0, Math.min(127, Math.round(value))) });
  };

  return (
    <section className="panel tool-panel midi-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">OPTIONAL</span>
          <h2>전자드럼 MIDI 조작</h2>
        </div>
        <span className={enabled ? 'status-chip active' : 'status-chip'}>
          {enabled ? `${connectedInputs.length}대 연결` : supported ? '지원됨' : '미지원'}
        </span>
      </div>

      {!supported ? (
        <p className="empty-control">이 브라우저에서는 Web MIDI를 사용할 수 없습니다. 다른 기능은 정상적으로 사용할 수 있습니다.</p>
      ) : (
        <>
          <div className="compact-grid four midi-mapping-grid">
            <label>재생/정지<input type="number" min={0} max={127} value={mappings.togglePlayback} onChange={(event) => update('togglePlayback', Number(event.target.value))} /></label>
            <label>이전 구간<input type="number" min={0} max={127} value={mappings.previous} onChange={(event) => update('previous', Number(event.target.value))} /></label>
            <label>구간 처음<input type="number" min={0} max={127} value={mappings.restart} onChange={(event) => update('restart', Number(event.target.value))} /></label>
            <label>다음 구간<input type="number" min={0} max={127} value={mappings.next} onChange={(event) => update('next', Number(event.target.value))} /></label>
          </div>
          <p className="hint">기본값: 킥 36 재생/정지, 사이드스틱 37 이전, 스네어 38 처음, 크래시 49 다음. 마지막 입력 {lastNote ?? '-'}</p>
          {error && <div className="message-banner error">{error}</div>}
          <div className="button-row">
            <button type="button" className="primary-button" disabled={enabled} onClick={onEnable}>MIDI 연결</button>
            <button type="button" className="secondary-button" disabled={!enabled} onClick={onDisable}>연결 해제</button>
          </div>
        </>
      )}
    </section>
  );
}
