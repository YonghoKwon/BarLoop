import { useRef, useState, type ChangeEvent } from 'react';
import { formatTime } from '../lib/time';

export interface PracticeSection {
  id: string;
  name: string;
  start: number;
  end: number;
  bpm: number;
  playbackRate: number;
  repeatTarget: number;
  note: string;
}

export interface ExportedPracticeData {
  version: 1;
  exportedAt: string;
  mediaKey: string;
  sections: PracticeSection[];
}

interface SectionPresetPanelProps {
  mediaKey: string;
  sections: PracticeSection[];
  currentStart: number;
  currentEnd: number;
  bpm: number;
  playbackRate: number;
  disabled: boolean;
  onSectionsChange: (sections: PracticeSection[]) => void;
  onLoad: (section: PracticeSection) => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}

export default function SectionPresetPanel({
  mediaKey,
  sections,
  currentStart,
  currentEnd,
  bpm,
  playbackRate,
  disabled,
  onSectionsChange,
  onLoad,
  onNotice,
  onError,
}: SectionPresetPanelProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [repeatTarget, setRepeatTarget] = useState(10);
  const importRef = useRef<HTMLInputElement>(null);

  const addSection = () => {
    if (disabled || currentEnd <= currentStart) {
      onError('먼저 유효한 반복 구간을 설정해 주세요.');
      return;
    }
    const next: PracticeSection = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name: name.trim() || `구간 ${sections.length + 1}`,
      start: currentStart,
      end: currentEnd,
      bpm,
      playbackRate,
      repeatTarget: Math.max(1, Math.round(repeatTarget)),
      note: note.trim(),
    };
    onSectionsChange([...sections, next]);
    setName('');
    setNote('');
    onNotice(`“${next.name}” 구간을 저장했습니다.`);
  };

  const exportSections = () => {
    const payload: ExportedPracticeData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      mediaKey,
      sections,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `barloop-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSections = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ExportedPracticeData>;
      if (parsed.version !== 1 || !Array.isArray(parsed.sections)) throw new Error('invalid');
      const safeSections = parsed.sections.filter(
        (section): section is PracticeSection =>
          typeof section?.id === 'string' &&
          typeof section.name === 'string' &&
          Number.isFinite(section.start) &&
          Number.isFinite(section.end) &&
          section.end > section.start,
      );
      onSectionsChange(safeSections);
      onNotice(`${safeSections.length}개 연습 구간을 불러왔습니다.`);
    } catch {
      onError('BarLoop에서 내보낸 올바른 JSON 파일이 아닙니다.');
    }
  };

  return (
    <section className="panel tool-panel section-panel">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">SECTIONS</span>
          <h2>연습 구간 보관함</h2>
        </div>
        <span className="status-chip">{sections.length}개</span>
      </div>

      <div className="section-create-grid">
        <label>
          구간 이름
          <input value={name} placeholder="예: Chorus Fill" onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          목표 반복
          <input
            type="number"
            min={1}
            max={999}
            value={repeatTarget}
            onChange={(event) => setRepeatTarget(Number(event.target.value))}
          />
        </label>
        <label className="grow">
          메모
          <input value={note} placeholder="킥-플로어 탐 연결" onChange={(event) => setNote(event.target.value)} />
        </label>
        <button type="button" className="primary-button" disabled={disabled} onClick={addSection}>
          현재 구간 저장
        </button>
      </div>

      <div className="section-list">
        {sections.length === 0 ? (
          <p className="empty-control">자주 연습하는 필인·벌스·코러스 구간을 저장해 보세요.</p>
        ) : (
          sections.map((section) => (
            <article key={section.id}>
              <button type="button" className="section-load" onClick={() => onLoad(section)}>
                <strong>{section.name}</strong>
                <span>{formatTime(section.start, true)}–{formatTime(section.end, true)}</span>
                <small>{section.bpm} BPM · {Math.round(section.playbackRate * 100)}% · 목표 {section.repeatTarget}회</small>
                {section.note && <em>{section.note}</em>}
              </button>
              <button
                type="button"
                className="danger-text-button"
                aria-label={`${section.name} 삭제`}
                onClick={() => onSectionsChange(sections.filter((item) => item.id !== section.id))}
              >
                삭제
              </button>
            </article>
          ))
        )}
      </div>

      <div className="button-row">
        <button type="button" className="secondary-button" disabled={sections.length === 0} onClick={exportSections}>
          JSON 내보내기
        </button>
        <button type="button" className="secondary-button" onClick={() => importRef.current?.click()}>
          JSON 불러오기
        </button>
        <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importSections} />
      </div>
    </section>
  );
}
